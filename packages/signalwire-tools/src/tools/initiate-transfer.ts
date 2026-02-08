/**
 * SWAIG Function: initiate-transfer
 *
 * Called by the AI agent to execute a warm transfer to a sales rep.
 * Creates a SignalWire conference, calls the rep, and manages the transfer flow.
 */

import type { Request, Response } from 'express';
import { z } from 'zod';
import { Voice } from '@signalwire/realtime-api';
import { CallService, DealerService } from '@dealerbdc/core';
import { db, dealerNumbers } from '@dealerbdc/database';
import { logger, config } from '@dealerbdc/shared';
import { eq, and } from 'drizzle-orm';

// SWAIG function input schema
const InitiateTransferInputSchema = z.object({
  call_session_id: z.string().uuid(),
  dealer_id: z.string().uuid(),
  user_id: z.string().uuid(),
  qualification: z
    .object({
      vehicle_interest: z.string().optional(),
      timeline: z.string().optional(),
      trade_in: z.boolean().optional(),
      payment_method: z.string().optional(),
      budget: z.string().optional(),
    })
    .optional(),
  brief_message: z.string().optional(),
});

export async function initiateTransfer(req: Request, res: Response) {
  try {
    // Validate input
    const input = InitiateTransferInputSchema.parse(req.body);

    logger.info(
      {
        callSessionId: input.call_session_id,
        userId: input.user_id,
      },
      'Initiating warm transfer'
    );

    const callService = new CallService();
    const dealerService = new DealerService();

    // Get call session
    const callSession = await callService.getCallSession(input.call_session_id);
    if (!callSession) {
      return res.status(404).json({
        success: false,
        error: 'Call session not found',
      });
    }

    // Get rep details
    const rep = await db.query.dealerUsers.findFirst({
      where: (users, { eq, and }) =>
        and(eq(users.id, input.user_id), eq(users.dealerId, input.dealer_id)),
    });

    if (!rep) {
      return res.status(404).json({
        success: false,
        error: 'Sales representative not found',
      });
    }

    // Get dealer's outbound number
    const [dealerNumber] = await db.query.dealerNumbers.findMany({
      where: (numbers, { eq, and }) =>
        and(eq(numbers.dealerId, input.dealer_id), eq(numbers.status, 'active')),
      limit: 1,
    });

    if (!dealerNumber) {
      return res.status(404).json({
        success: false,
        error: 'No active dealer phone number found',
      });
    }

    // Initialize SignalWire client
    const client = new Voice.Client({
      project: config.signalwire.projectId,
      token: config.signalwire.apiToken,
      topics: ['office'],
    });

    await client.connect();

    // Create conference room name
    const conferenceName = `transfer-${input.call_session_id}`;

    // Dial the rep
    const repCall = await client.dialPhone({
      from: dealerNumber.phoneNumber,
      to: rep.phone!,
      timeout: 30,
    });

    logger.info(
      {
        callSessionId: input.call_session_id,
        repPhone: rep.phone,
        conferenceName,
      },
      'Dialing rep for warm transfer'
    );

    // Generate brief message for AI to tell rep
    const brief = input.brief_message || generateBriefMessage(rep, input.qualification);

    // Update call session with transfer info
    await callService.updateCallSession(input.call_session_id, {
      status: 'transferring',
      transferredToUserId: input.user_id,
    });

    // Return SWAIG action
    return res.json({
      success: true,
      action: 'transfer',
      conference_name: conferenceName,
      rep_name: `${rep.firstName} ${rep.lastName}`,
      brief_message: brief,
      instruction:
        `Rep ${rep.firstName} is being dialed. When they answer, brief them: "${brief}". ` +
        `Then say to the lead: "Great! I have ${rep.firstName} ${rep.lastName} on the line, who specializes in ${rep.department}. ` +
        `${rep.firstName} can help you with next steps. Let me connect you now."`,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      logger.warn({ error: error.errors }, 'Invalid initiate-transfer input');
      return res.status(400).json({
        error: 'Invalid input',
        details: error.errors,
      });
    }

    logger.error({ error }, 'Error in initiate-transfer');
    return res.status(500).json({
      success: false,
      error: 'Internal server error',
    });
  }
}

/**
 * Generate a brief message for the AI to tell the rep
 */
function generateBriefMessage(
  rep: any,
  qualification?: {
    vehicle_interest?: string;
    timeline?: string;
    trade_in?: boolean;
    payment_method?: string;
    budget?: string;
  }
): string {
  const parts: string[] = [];

  parts.push(`Hi ${rep.firstName}, this is the AI assistant.`);

  if (qualification?.vehicle_interest) {
    parts.push(`Lead is interested in ${qualification.vehicle_interest}.`);
  }

  if (qualification?.timeline) {
    parts.push(`Timeline: ${qualification.timeline}.`);
  }

  if (qualification?.trade_in !== undefined) {
    parts.push(`${qualification.trade_in ? 'Has' : 'No'} trade-in.`);
  }

  if (qualification?.payment_method) {
    parts.push(`Payment method: ${qualification.payment_method}.`);
  }

  if (qualification?.budget) {
    parts.push(`Budget: ${qualification.budget}.`);
  }

  parts.push('Ready for me to connect them?');

  return parts.join(' ');
}
