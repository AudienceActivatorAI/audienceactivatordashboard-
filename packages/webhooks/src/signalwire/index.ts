/**
 * SignalWire Webhook Handlers
 *
 * Handles voice callbacks, call status updates, and conference events
 * from SignalWire.
 */

import { Hono } from 'hono';
import { z } from 'zod';
import { CallService } from '@dealerbdc/core';
import { logger } from '@dealerbdc/shared';

export const signalwireRouter = new Hono();

/**
 * POST /webhooks/signalwire/voice
 *
 * Initial voice webhook when call connects
 * Returns TwiML to handle the call
 */
signalwireRouter.post('/voice', async (c) => {
  try {
    const body = await c.req.parseBody();

    logger.info({ body }, 'SignalWire voice webhook');

    // For now, return simple TwiML
    // In production, this would handle initial call routing
    const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say>Please wait while we connect your call.</Say>
</Response>`;

    return c.text(twiml, 200, {
      'Content-Type': 'application/xml',
    });
  } catch (error) {
    logger.error({ error }, 'Error in voice webhook');
    return c.json({ error: 'Internal server error' }, 500);
  }
});

/**
 * POST /webhooks/signalwire/status
 *
 * Call status updates (initiated, ringing, answered, completed, etc.)
 */
signalwireRouter.post('/status', async (c) => {
  try {
    const body = await c.req.parseBody();

    const callSid = body.CallSid as string;
    const callStatus = body.CallStatus as string;
    const duration = body.CallDuration ? parseInt(body.CallDuration as string, 10) : undefined;

    logger.info(
      {
        callSid,
        callStatus,
        duration,
      },
      'SignalWire status callback'
    );

    const callService = new CallService();

    // Find call session by SignalWire SID
    const session = await callService.getCallSessionBySignalwireSid(callSid);

    if (session) {
      // Update call session status
      const updates: any = {
        status: mapSignalWireStatus(callStatus),
      };

      if (callStatus === 'completed' && duration !== undefined) {
        updates.durationSeconds = duration;
        updates.endedAt = new Date();
      } else if (callStatus === 'in-progress') {
        updates.answeredAt = new Date();
      }

      await callService.updateCallSession(session.id, updates);

      logger.info(
        {
          callSessionId: session.id,
          newStatus: updates.status,
        },
        'Call session updated from status callback'
      );
    }

    return c.json({ success: true });
  } catch (error) {
    logger.error({ error }, 'Error in status webhook');
    return c.json({ error: 'Internal server error' }, 500);
  }
});

/**
 * POST /webhooks/signalwire/conference-status
 *
 * Conference status updates (for warm transfers)
 */
signalwireRouter.post('/conference-status', async (c) => {
  try {
    const body = await c.req.parseBody();

    const conferenceSid = body.ConferenceSid as string;
    const statusCallbackEvent = body.StatusCallbackEvent as string;
    const friendlyName = body.FriendlyName as string;

    logger.info(
      {
        conferenceSid,
        event: statusCallbackEvent,
        name: friendlyName,
      },
      'Conference status callback'
    );

    // Extract call_session_id from conference name (format: transfer-{uuid})
    if (friendlyName?.startsWith('transfer-')) {
      const callSessionId = friendlyName.replace('transfer-', '');
      const callService = new CallService();

      if (statusCallbackEvent === 'participant-join') {
        logger.info({ callSessionId, conferenceSid }, 'Participant joined conference');
      } else if (statusCallbackEvent === 'participant-leave') {
        logger.info({ callSessionId, conferenceSid }, 'Participant left conference');
      } else if (statusCallbackEvent === 'conference-end') {
        logger.info({ callSessionId, conferenceSid }, 'Conference ended');

        // Mark transfer as completed
        const session = await callService.getCallSession(callSessionId);
        if (session && session.transferredToUserId) {
          await callService.updateCallSession(callSessionId, {
            transferCompleted: true,
            status: 'completed',
            outcome: 'transferred',
          });
        }
      }
    }

    return c.json({ success: true });
  } catch (error) {
    logger.error({ error }, 'Error in conference-status webhook');
    return c.json({ error: 'Internal server error' }, 500);
  }
});

/**
 * Map SignalWire call status to our internal status
 */
function mapSignalWireStatus(signalwireStatus: string): string {
  const statusMap: Record<string, string> = {
    queued: 'initiated',
    initiated: 'initiated',
    ringing: 'ringing',
    'in-progress': 'answered',
    completed: 'completed',
    failed: 'failed',
    busy: 'busy',
    'no-answer': 'no_answer',
    canceled: 'failed',
  };

  return statusMap[signalwireStatus] || 'initiated';
}
