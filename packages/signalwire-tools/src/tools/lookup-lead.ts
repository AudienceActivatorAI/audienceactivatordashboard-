/**
 * SWAIG Function: lookup-lead
 *
 * Called by the AI agent at the start of a call to retrieve lead context.
 * Returns lead information, intent score, and vehicle of interest.
 */

import type { Request, Response } from 'express';
import { z } from 'zod';
import { LeadService, DealerService } from '@dealerbdc/core';
import { logger, ValidationError } from '@dealerbdc/shared';

// SWAIG function input schema
const LookupLeadInputSchema = z.object({
  dealer_id: z.string().uuid(),
  phone: z.string(),
  call_session_id: z.string().uuid().optional(),
});

export async function lookupLead(req: Request, res: Response) {
  try {
    // Validate input
    const input = LookupLeadInputSchema.parse(req.body);

    logger.info({ dealerId: input.dealer_id, phone: input.phone }, 'Looking up lead');

    const leadService = new LeadService();
    const dealerService = new DealerService();

    // Get dealer info
    const dealer = await dealerService.getDealer(input.dealer_id);
    if (!dealer) {
      return res.json({
        found: false,
        message: 'Dealer not found',
      });
    }

    // Find lead by phone
    const lead = await leadService.findLeadByPhone(input.dealer_id, input.phone);

    if (!lead) {
      // Lead not found - this is okay, AI can still proceed
      return res.json({
        found: false,
        dealer_name: dealer.name,
        message: 'No existing lead record found',
      });
    }

    // Get latest intent score
    const intentScore = await leadService.getLatestIntentScore(lead.id);

    // Return lead context
    return res.json({
      found: true,
      lead: {
        id: lead.id,
        first_name: lead.firstName,
        last_name: lead.lastName,
        email: lead.email,
        vehicle_of_interest: lead.vehicleOfInterest,
        department: lead.department,
        source: lead.source,
        status: lead.status,
        intent_score: intentScore?.score || 0,
      },
      dealer: {
        name: dealer.name,
        timezone: dealer.timezone,
      },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      logger.warn({ error: error.errors }, 'Invalid lookup-lead input');
      return res.status(400).json({
        error: 'Invalid input',
        details: error.errors,
      });
    }

    logger.error({ error }, 'Error in lookup-lead');
    return res.status(500).json({
      error: 'Internal server error',
    });
  }
}
