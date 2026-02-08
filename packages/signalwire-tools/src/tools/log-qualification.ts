/**
 * SWAIG Function: log-qualification
 *
 * Called by the AI agent to store qualification data collected during
 * the conversation. This data is later used for reporting and CRM sync.
 */

import type { Request, Response } from 'express';
import { z } from 'zod';
import { CallService, LeadService } from '@dealerbdc/core';
import { logger } from '@dealerbdc/shared';

// SWAIG function input schema
const LogQualificationInputSchema = z.object({
  call_session_id: z.string().uuid(),
  lead_id: z.string().uuid(),
  qualification: z.object({
    vehicle_interest: z.string().optional(),
    timeline: z.string().optional(),
    trade_in: z.boolean().optional(),
    payment_method: z.enum(['cash', 'finance', 'lease', 'mix']).optional(),
    budget: z.string().optional(),
    down_payment: z.string().optional(),
    credit_concern: z.boolean().optional(),
    additional_notes: z.string().optional(),
  }),
});

export async function logQualification(req: Request, res: Response) {
  try {
    // Validate input
    const input = LogQualificationInputSchema.parse(req.body);

    logger.info(
      {
        callSessionId: input.call_session_id,
        leadId: input.lead_id,
      },
      'Logging qualification data'
    );

    const callService = new CallService();
    const leadService = new LeadService();

    // Get call session
    const callSession = await callService.getCallSession(input.call_session_id);
    if (!callSession) {
      return res.status(404).json({
        success: false,
        error: 'Call session not found',
      });
    }

    // Update lead with vehicle interest if provided
    if (input.qualification.vehicle_interest) {
      await leadService.updateLead(input.lead_id, {
        vehicleOfInterest: input.qualification.vehicle_interest,
      });
    }

    // Store qualification in call session metadata
    await callService.updateCallSession(input.call_session_id, {
      metadata: {
        ...callSession.metadata,
        qualification: input.qualification,
        qualified_at: new Date().toISOString(),
      },
    });

    logger.info(
      {
        callSessionId: input.call_session_id,
        qualification: input.qualification,
      },
      'Qualification data logged successfully'
    );

    return res.json({
      success: true,
      message: 'Qualification data logged successfully',
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      logger.warn({ error: error.errors }, 'Invalid log-qualification input');
      return res.status(400).json({
        error: 'Invalid input',
        details: error.errors,
      });
    }

    logger.error({ error }, 'Error in log-qualification');
    return res.status(500).json({
      success: false,
      error: 'Internal server error',
    });
  }
}
