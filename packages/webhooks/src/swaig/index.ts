/**
 * SWAIG Webhook Handlers
 *
 * Handles SWAIG AI agent lifecycle events:
 * - call-started: When SWAIG agent begins conversation
 * - call-ended: When conversation completes
 * - transcript: Real-time transcript updates
 */

import { Hono } from 'hono';
import { z } from 'zod';
import { CallService } from '@dealerbdc/core';
import { logger } from '@dealerbdc/shared';
import { inngest } from '@dealerbdc/jobs';

export const swaigRouter = new Hono();

/**
 * POST /webhooks/swaig/call-started
 *
 * Called when SWAIG agent starts a conversation
 */
swaigRouter.post('/call-started', async (c) => {
  try {
    const body = await c.req.json();

    const swaigSessionId = body.session_id;
    const callSid = body.call_sid;
    const toNumber = body.to;
    const fromNumber = body.from;

    logger.info(
      {
        swaigSessionId,
        callSid,
        to: toNumber,
        from: fromNumber,
      },
      'SWAIG call started'
    );

    const callService = new CallService();

    // Find call session by SWAIG session ID
    const session = await callService.getCallSessionBySwaigId(swaigSessionId);

    if (session) {
      // Update with SignalWire call SID
      await callService.updateCallSession(session.id, {
        signalwireCallSid: callSid,
        status: 'ringing',
      });

      logger.info({ callSessionId: session.id }, 'Updated call session with SignalWire SID');
    } else {
      logger.warn({ swaigSessionId }, 'Call session not found for SWAIG session');
    }

    return c.json({ success: true });
  } catch (error) {
    logger.error({ error }, 'Error in SWAIG call-started webhook');
    return c.json({ error: 'Internal server error' }, 500);
  }
});

/**
 * POST /webhooks/swaig/call-ended
 *
 * Called when SWAIG conversation ends
 */
swaigRouter.post('/call-ended', async (c) => {
  try {
    const body = await c.req.json();

    const swaigSessionId = body.session_id;
    const callSid = body.call_sid;
    const duration = body.duration_seconds;
    const outcome = body.outcome; // 'completed', 'no_answer', 'busy', 'failed'
    const transcript = body.transcript;

    logger.info(
      {
        swaigSessionId,
        callSid,
        duration,
        outcome,
      },
      'SWAIG call ended'
    );

    const callService = new CallService();

    // Find call session
    const session = await callService.getCallSessionBySwaigId(swaigSessionId);

    if (session) {
      // Update call session
      await callService.updateCallSession(session.id, {
        status: 'completed',
        endedAt: new Date(),
        durationSeconds: duration,
        outcome: mapSwaigOutcome(outcome),
      });

      // Save transcript if provided
      if (transcript) {
        await callService.saveTranscript(session.id, transcript.full_text || '', transcript.turns || []);

        logger.info({ callSessionId: session.id }, 'Transcript saved');

        // Trigger Inngest job to process transcript and generate summary
        await inngest.send({
          name: 'call/transcript-ready',
          data: {
            call_session_id: session.id,
            dealer_id: session.dealerId,
            lead_id: session.leadId,
          },
        });
      }

      logger.info({ callSessionId: session.id }, 'Call session completed');
    }

    return c.json({ success: true });
  } catch (error) {
    logger.error({ error }, 'Error in SWAIG call-ended webhook');
    return c.json({ error: 'Internal server error' }, 500);
  }
});

/**
 * POST /webhooks/swaig/transcript
 *
 * Real-time transcript updates during call
 */
swaigRouter.post('/transcript', async (c) => {
  try {
    const body = await c.req.json();

    const swaigSessionId = body.session_id;
    const turn = body.turn; // { role: 'ai' | 'user', text: string, timestamp: string }

    logger.debug(
      {
        swaigSessionId,
        role: turn.role,
        text: turn.text?.substring(0, 50),
      },
      'SWAIG transcript update'
    );

    // For now, just log. Could store real-time for live monitoring.
    // In production, might stream to dashboard via WebSocket

    return c.json({ success: true });
  } catch (error) {
    logger.error({ error }, 'Error in SWAIG transcript webhook');
    return c.json({ error: 'Internal server error' }, 500);
  }
});

/**
 * Map SWAIG outcome to our internal outcome
 */
function mapSwaigOutcome(swaigOutcome: string): string {
  const outcomeMap: Record<string, string> = {
    completed: 'qualified',
    transferred: 'transferred',
    appointment_set: 'appointment_set',
    no_answer: 'no_answer',
    busy: 'no_answer',
    failed: 'no_answer',
    opted_out: 'not_interested',
  };

  return outcomeMap[swaigOutcome] || 'qualified';
}
