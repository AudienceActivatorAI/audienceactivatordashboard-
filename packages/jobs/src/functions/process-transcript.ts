/**
 * Inngest Job: process-transcript
 *
 * Processes call transcripts to generate AI summaries:
 * 1. Fetches full transcript from database
 * 2. Calls Claude/GPT-4 to generate summary
 * 3. Extracts qualification data and sentiment
 * 4. Updates call summary in database
 * 5. Triggers notification to rep
 */

import { inngest } from '../client.js';
import { CallService, LeadService } from '@dealerbdc/core';
import { logger, config } from '@dealerbdc/shared';
import Anthropic from '@anthropic-ai/sdk';

// Initialize Claude client
const anthropic = new Anthropic({
  apiKey: config.anthropic?.apiKey || process.env.ANTHROPIC_API_KEY,
});

export const processTranscript = inngest.createFunction(
  {
    id: 'process-transcript',
    name: 'Process Call Transcript and Generate Summary',
    retries: 1,
  },
  { event: 'call/transcript-ready' },
  async ({ event, step }) => {
    const { call_session_id, dealer_id, lead_id } = event.data;

    logger.info({ callSessionId: call_session_id }, 'Processing transcript');

    // Step 1: Fetch transcript
    const transcript = await step.run('fetch-transcript', async () => {
      const callService = new CallService();
      const transcriptData = await callService.getTranscript(call_session_id);

      if (!transcriptData) {
        throw new Error('Transcript not found');
      }

      return transcriptData;
    });

    // Step 2: Generate AI summary using Claude
    const summary = await step.run('generate-ai-summary', async () => {
      const prompt = `You are analyzing a call transcript between an AI assistant and a car shopper at a dealership.

TRANSCRIPT:
${transcript.fullTranscript}

Please provide:
1. A 2-3 sentence summary of the call
2. Key qualification points (vehicle interest, timeline, trade-in, payment method, budget)
3. Sentiment (positive, neutral, or negative)
4. Recommended next steps

Format your response as JSON:
{
  "summary": "Brief summary here",
  "key_points": ["Point 1", "Point 2", ...],
  "qualification": {
    "vehicle_interest": "string or null",
    "timeline": "string or null",
    "trade_in": boolean or null,
    "payment_method": "string or null",
    "budget": "string or null"
  },
  "sentiment": "positive|neutral|negative",
  "next_steps": "Recommended action"
}`;

      const message = await anthropic.messages.create({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 1024,
        messages: [
          {
            role: 'user',
            content: prompt,
          },
        ],
      });

      const responseText = message.content[0].type === 'text' ? message.content[0].text : '';

      // Parse JSON response
      const jsonMatch = responseText.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('Failed to extract JSON from Claude response');
      }

      const parsed = JSON.parse(jsonMatch[0]);

      logger.info(
        {
          callSessionId: call_session_id,
          sentiment: parsed.sentiment,
          keyPointsCount: parsed.key_points?.length || 0,
        },
        'AI summary generated'
      );

      return parsed;
    });

    // Step 3: Save summary to database
    await step.run('save-summary', async () => {
      const callService = new CallService();

      await callService.saveSummary(call_session_id, summary.summary, {
        keyPoints: summary.key_points,
        sentiment: summary.sentiment,
        qualificationData: summary.qualification,
      });

      logger.info({ callSessionId: call_session_id }, 'Summary saved to database');
    });

    // Step 4: Update lead with qualification data
    await step.run('update-lead', async () => {
      const leadService = new LeadService();

      if (summary.qualification?.vehicle_interest) {
        await leadService.updateLead(lead_id, {
          vehicleOfInterest: summary.qualification.vehicle_interest,
        });
      }

      // Update lead status based on outcome
      const callService = new CallService();
      const session = await callService.getCallSession(call_session_id);

      if (session?.outcome === 'transferred') {
        await leadService.updateStatus(lead_id, 'transferred');
      } else if (session?.outcome === 'appointment_set') {
        await leadService.updateStatus(lead_id, 'appointment_set');
      } else if (summary.sentiment === 'positive') {
        await leadService.updateStatus(lead_id, 'qualified');
      }
    });

    // Step 5: Trigger notification to rep (if transferred)
    const shouldNotify = await step.run('check-if-should-notify', async () => {
      const callService = new CallService();
      const session = await callService.getCallSession(call_session_id);

      return session?.transferredToUserId && session?.transferCompleted;
    });

    if (shouldNotify) {
      await step.sendEvent('send-notification', {
        name: 'notification/send',
        data: {
          dealer_id,
          call_session_id,
          lead_id,
          type: 'transfer_ready',
          title: 'Call Summary Ready',
          message: summary.summary,
          channel: 'sms',
        },
      });
    }

    return {
      success: true,
      summary: summary.summary,
      sentiment: summary.sentiment,
      key_points_count: summary.key_points?.length || 0,
    };
  }
);
