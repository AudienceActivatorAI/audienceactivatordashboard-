/**
 * Inngest Job: trigger-call
 *
 * Orchestrates the call initiation process:
 * 1. Validates calling window (timezone-aware)
 * 2. Checks opt-outs (TCPA compliance)
 * 3. Checks rate limits (concurrent + hourly)
 * 4. Creates call session and attempt
 * 5. Initiates SignalWire SWAIG call
 */

import { inngest } from '../client.js';
import { DealerService, LeadService, CallService } from '@dealerbdc/core';
import { db, dealerNumbers } from '@dealerbdc/database';
import { logger, config } from '@dealerbdc/shared';
import { Voice } from '@signalwire/realtime-api';
import { eq, and } from 'drizzle-orm';

export const triggerCall = inngest.createFunction(
  {
    id: 'trigger-call',
    name: 'Trigger AI Call to Lead',
    retries: 2,
  },
  { event: 'pixel-event/high-intent' },
  async ({ event, step }) => {
    const { dealer_id, lead_id, pixel_event_id, intent_score } = event.data;

    logger.info(
      {
        dealerId: dealer_id,
        leadId: lead_id,
        intentScore: intent_score,
      },
      'Trigger call job started'
    );

    // Step 1: Check calling window
    const canCall = await step.run('check-calling-window', async () => {
      const dealerService = new DealerService();
      const isWithinWindow = await dealerService.isWithinCallingWindow(dealer_id);

      logger.info({ dealerId: dealer_id, isWithinWindow }, 'Calling window check');

      return isWithinWindow;
    });

    if (!canCall) {
      logger.info({ dealerId: dealer_id }, 'Outside calling hours - skipping call');
      return {
        skipped: true,
        reason: 'outside_calling_hours',
        will_retry: false,
      };
    }

    // Step 2: Get lead and check opt-outs
    const lead = await step.run('get-lead-and-check-optout', async () => {
      const leadService = new LeadService();
      const leadData = await leadService.getLead(lead_id);

      if (!leadData.phone) {
        throw new Error('Lead has no phone number');
      }

      // Check if opted out
      await leadService.checkOptOut(dealer_id, leadData.phone, 'call');

      return leadData;
    });

    // Step 3: Check rate limits
    await step.run('check-rate-limits', async () => {
      const dealerService = new DealerService();

      const concurrentCalls = await dealerService.getCurrentConcurrentCalls(dealer_id);
      const callsThisHour = await dealerService.getCallsInLastHour(dealer_id);
      const profile = await dealerService.getCallingProfile(dealer_id);

      if (concurrentCalls >= profile.maxConcurrentCalls) {
        throw new Error(`Max concurrent calls reached: ${concurrentCalls}/${profile.maxConcurrentCalls}`);
      }

      if (callsThisHour >= profile.maxCallsPerHour) {
        throw new Error(`Hourly rate limit reached: ${callsThisHour}/${profile.maxCallsPerHour}`);
      }

      logger.info(
        {
          dealerId: dealer_id,
          concurrentCalls,
          callsThisHour,
          limits: {
            maxConcurrent: profile.maxConcurrentCalls,
            maxPerHour: profile.maxCallsPerHour,
          },
        },
        'Rate limit check passed'
      );
    });

    // Step 4: Get dealer's outbound number
    const dealerNumber = await step.run('get-dealer-number', async () => {
      const [number] = await db.query.dealerNumbers.findMany({
        where: (numbers, { eq, and }) => and(eq(numbers.dealerId, dealer_id), eq(numbers.status, 'active')),
        limit: 1,
      });

      if (!number) {
        throw new Error('No active dealer phone number found');
      }

      return number;
    });

    // Step 5: Create call attempt
    const callAttempt = await step.run('create-call-attempt', async () => {
      const callService = new CallService();

      // Get latest attempt number
      const latestAttempt = await callService.getLatestCallAttempt(lead_id);
      const attemptNumber = (latestAttempt?.attemptNumber || 0) + 1;

      return callService.createCallAttempt(dealer_id, lead_id, attemptNumber);
    });

    // Step 6: Initiate SignalWire SWAIG call
    const callSession = await step.run('initiate-swaig-call', async () => {
      const callService = new CallService();

      // Initialize SignalWire client
      const client = new Voice.Client({
        project: config.signalwire.projectId,
        token: config.signalwire.apiToken,
        topics: ['office'],
      });

      await client.connect();

      // Create call session first (to get ID for context)
      const session = await callService.createCallSession({
        dealerId: dealer_id,
        leadId: lead_id,
        fromNumber: dealerNumber.phoneNumber,
        toNumber: lead.phone!,
        swaigAgentId: config.signalwire.aiAgentId,
      });

      // Initiate AI call with context
      const aiCall = await client.aiCall({
        to: lead.phone!,
        from: dealerNumber.phoneNumber,
        aiAgent: config.signalwire.aiAgentId,
        context: {
          dealer_id,
          lead_id,
          call_session_id: session.id,
          first_name: lead.firstName,
          last_name: lead.lastName,
          vehicle_of_interest: lead.vehicleOfInterest,
          intent_score,
        },
      });

      // Update session with SWAIG session ID
      await callService.updateCallSession(session.id, {
        swaigSessionId: aiCall.id,
      });

      // Update call attempt with session ID
      await callService.updateCallAttempt(callAttempt.id, {
        status: 'calling',
        callSessionId: session.id,
        attemptedAt: new Date(),
      });

      logger.info(
        {
          callSessionId: session.id,
          swaigSessionId: aiCall.id,
          to: lead.phone,
          from: dealerNumber.phoneNumber,
        },
        'SWAIG call initiated'
      );

      return session;
    });

    // Success!
    return {
      success: true,
      call_session_id: callSession.id,
      lead_phone: lead.phone,
      dealer_number: dealerNumber.phoneNumber,
    };
  }
);
