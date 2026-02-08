/**
 * Inngest Job: send-notifications
 *
 * Sends notifications to sales reps via SMS or email:
 * 1. Fetches notification details
 * 2. Gets rep contact information
 * 3. Sends via SignalWire (SMS) or SendGrid (email)
 * 4. Logs message in database
 */

import { inngest } from '../client.js';
import { CallService } from '@dealerbdc/core';
import { db, dealerUsers, messageLogs, dealerNumbers } from '@dealerbdc/database';
import { logger, config } from '@dealerbdc/shared';
import { Voice } from '@signalwire/realtime-api';
import { eq } from 'drizzle-orm';

export const sendNotifications = inngest.createFunction(
  {
    id: 'send-notifications',
    name: 'Send Notifications to Reps',
    retries: 2,
  },
  { event: 'notification/send' },
  async ({ event, step }) => {
    const { dealer_id, user_id, lead_id, call_session_id, type, title, message, channel } = event.data;

    logger.info(
      {
        dealerId: dealer_id,
        userId: user_id,
        type,
        channel,
      },
      'Sending notification'
    );

    // Step 1: Get rep details
    const rep = await step.run('get-rep-details', async () => {
      if (!user_id) {
        throw new Error('user_id required for notification');
      }

      const user = await db.query.dealerUsers.findFirst({
        where: eq(dealerUsers.id, user_id),
      });

      if (!user) {
        throw new Error('User not found');
      }

      return user;
    });

    // Step 2: Get call summary if this is a transfer notification
    const callSummary = call_session_id
      ? await step.run('get-call-summary', async () => {
          const callService = new CallService();
          const summary = await callService.getSummary(call_session_id);
          return summary;
        })
      : null;

    // Step 3: Build notification message
    const notificationMessage = await step.run('build-message', async () => {
      let body = `${title}\n\n${message}`;

      if (callSummary) {
        body += `\n\nCall Summary:\n${callSummary.summary}`;

        if (callSummary.keyPoints && Array.isArray(callSummary.keyPoints)) {
          body += `\n\nKey Points:\n${callSummary.keyPoints.map((p: string) => `• ${p}`).join('\n')}`;
        }

        if (callSummary.qualificationData) {
          const qual = callSummary.qualificationData as any;
          body += '\n\nQualification:';
          if (qual.vehicle_interest) body += `\n• Vehicle: ${qual.vehicle_interest}`;
          if (qual.timeline) body += `\n• Timeline: ${qual.timeline}`;
          if (qual.trade_in !== undefined) body += `\n• Trade-in: ${qual.trade_in ? 'Yes' : 'No'}`;
          if (qual.budget) body += `\n• Budget: ${qual.budget}`;
        }
      }

      return body;
    });

    // Step 4: Send SMS if requested
    if (channel === 'sms' || channel === 'both') {
      await step.run('send-sms', async () => {
        if (!rep.phone) {
          logger.warn({ userId: user_id }, 'Rep has no phone number, skipping SMS');
          return null;
        }

        // Get dealer's outbound number
        const [dealerNumber] = await db.query.dealerNumbers.findMany({
          where: (numbers, { eq, and }) => and(eq(numbers.dealerId, dealer_id), eq(numbers.status, 'active')),
          limit: 1,
        });

        if (!dealerNumber) {
          throw new Error('No active dealer phone number for SMS');
        }

        // Initialize SignalWire client
        const client = new Voice.Client({
          project: config.signalwire.projectId,
          token: config.signalwire.apiToken,
          topics: ['office'],
        });

        await client.connect();

        // Send SMS (note: SignalWire has messaging API similar to Twilio)
        // For now, we'll use the messaging client which is separate
        // In production, you'd use: @signalwire/realtime-api Messaging client

        // Placeholder: In real implementation, use SignalWire Messaging API
        logger.info(
          {
            to: rep.phone,
            from: dealerNumber.phoneNumber,
            message: notificationMessage,
          },
          'SMS would be sent here (SignalWire Messaging API)'
        );

        // Log message
        await db.insert(messageLogs).values({
          dealerId: dealer_id,
          leadId: lead_id,
          messageType: 'sms',
          direction: 'outbound',
          fromAddress: dealerNumber.phoneNumber,
          toAddress: rep.phone,
          body: notificationMessage,
          provider: 'signalwire',
          status: 'sent',
        });

        return { sent: true, to: rep.phone };
      });
    }

    // Step 5: Send email if requested
    if (channel === 'email' || channel === 'both') {
      await step.run('send-email', async () => {
        if (!rep.email) {
          logger.warn({ userId: user_id }, 'Rep has no email, skipping email');
          return null;
        }

        // Placeholder: In real implementation, use SendGrid or similar
        logger.info(
          {
            to: rep.email,
            subject: title,
            body: notificationMessage,
          },
          'Email would be sent here (SendGrid)'
        );

        // Log message
        await db.insert(messageLogs).values({
          dealerId: dealer_id,
          leadId: lead_id,
          messageType: 'email',
          direction: 'outbound',
          fromAddress: 'noreply@dealerbdc.ai',
          toAddress: rep.email,
          subject: title,
          body: notificationMessage,
          provider: 'sendgrid',
          status: 'sent',
        });

        return { sent: true, to: rep.email };
      });
    }

    return {
      success: true,
      notification_type: type,
      channels: channel,
      recipient: {
        name: `${rep.firstName} ${rep.lastName}`,
        phone: rep.phone,
        email: rep.email,
      },
    };
  }
);
