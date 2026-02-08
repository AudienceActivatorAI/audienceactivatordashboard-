/**
 * SWAIG Function: get-routing-rules
 *
 * Called by the AI agent to determine which sales rep should receive
 * the warm transfer. Uses the RoutingEngine to evaluate rules and
 * find an available rep.
 */

import type { Request, Response } from 'express';
import { z } from 'zod';
import { RoutingEngine } from '@dealerbdc/core';
import { logger } from '@dealerbdc/shared';

// SWAIG function input schema
const GetRoutingRulesInputSchema = z.object({
  dealer_id: z.string().uuid(),
  lead_id: z.string().uuid().optional(),
  department: z.string().optional(),
  vehicle_type: z.string().optional(),
  intent_score: z.number().min(0).max(100).optional(),
  price_range: z.string().optional(),
});

export async function getRoutingRules(req: Request, res: Response) {
  try {
    // Validate input
    const input = GetRoutingRulesInputSchema.parse(req.body);

    logger.info({ dealerId: input.dealer_id, department: input.department }, 'Getting routing rules');

    const routingEngine = new RoutingEngine();

    // Build context for routing evaluation
    const context = {
      department: input.department,
      vehicleType: input.vehicle_type,
      intentScore: input.intent_score,
      priceRange: input.price_range,
    };

    // Evaluate routing rules to find target rep
    const routingResult = await routingEngine.evaluateRouting(input.dealer_id, context);

    if (!routingResult.targetUser) {
      // No available rep found - AI should handle fallback
      return res.json({
        found: false,
        message: 'No available representative found',
        fallback_message: 'All specialists are currently assisting other customers. Would you like to schedule a callback or leave a message?',
      });
    }

    // Return routing information
    return res.json({
      found: true,
      target_user: {
        id: routingResult.targetUser.id,
        first_name: routingResult.targetUser.firstName,
        last_name: routingResult.targetUser.lastName,
        phone: routingResult.targetUser.phone,
        department: routingResult.targetUser.department,
        role: routingResult.targetUser.role,
      },
      rule_matched: routingResult.matchedRule
        ? {
            name: routingResult.matchedRule.name,
            priority: routingResult.matchedRule.priority,
          }
        : undefined,
      message: `Routing to ${routingResult.targetUser.firstName} ${routingResult.targetUser.lastName} in ${routingResult.targetUser.department}`,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      logger.warn({ error: error.errors }, 'Invalid get-routing-rules input');
      return res.status(400).json({
        error: 'Invalid input',
        details: error.errors,
      });
    }

    logger.error({ error }, 'Error in get-routing-rules');
    return res.status(500).json({
      error: 'Internal server error',
    });
  }
}
