/**
 * Pixel Event Webhook Handler
 *
 * Ingests events from the Super Pixel tracking script and triggers
 * call automation via Inngest based on high-intent signals.
 */

import { Hono } from 'hono';
import { z } from 'zod';
import { db, pixelEvents, leads } from '@dealerbdc/database';
import { LeadService } from '@dealerbdc/core';
import { logger } from '@dealerbdc/shared';
import { inngest } from '@dealerbdc/jobs';
import { eq } from 'drizzle-orm';

export const pixelRouter = new Hono();

// Pixel event schema
const PixelEventSchema = z.object({
  dealer_id: z.string().uuid(),
  event_type: z.enum([
    'page_view',
    'vehicle_view',
    'form_started',
    'form_submitted',
    'payment_calculator',
    'trade_in_tool',
    'finance_preapproval',
    'test_drive_request',
  ]),
  event_data: z.record(z.unknown()),
  // Identity hints
  phone: z.string().optional(),
  email: z.string().optional(),
  cookie_id: z.string().optional(),
  ip_address: z.string().optional(),
  device_id: z.string().optional(),
  // Context
  page_url: z.string().url().optional(),
  referrer: z.string().optional(),
  user_agent: z.string().optional(),
  // Metadata
  timestamp: z.string().datetime().optional(),
});

/**
 * POST /webhooks/pixel
 *
 * Receive pixel events from website tracking
 */
pixelRouter.post('/', async (c) => {
  try {
    const body = await c.req.json();

    // Validate event
    const event = PixelEventSchema.parse(body);

    logger.info(
      {
        dealerId: event.dealer_id,
        eventType: event.event_type,
        phone: event.phone,
        email: event.email,
      },
      'Pixel event received'
    );

    const leadService = new LeadService();

    // Resolve or create lead
    let lead;
    if (event.phone || event.email) {
      lead = await leadService.resolveOrCreateLead({
        dealerId: event.dealer_id,
        phone: event.phone,
        email: event.email,
        cookieId: event.cookie_id,
        ipAddress: event.ip_address,
        deviceId: event.device_id,
        source: 'website',
        sourceDetail: event.page_url,
        vehicleOfInterest: event.event_data.vehicle_name as string | undefined,
        firstName: event.event_data.first_name as string | undefined,
        lastName: event.event_data.last_name as string | undefined,
      });
    }

    // Store pixel event
    const [pixelEvent] = await db
      .insert(pixelEvents)
      .values({
        dealerId: event.dealer_id,
        leadId: lead?.id,
        eventType: event.event_type,
        eventData: event.event_data,
        phone: event.phone,
        email: event.email,
        cookieId: event.cookie_id,
        ipAddress: event.ip_address ? event.ip_address : undefined,
        userAgent: event.user_agent,
        pageUrl: event.page_url,
        referrer: event.referrer,
      })
      .returning();

    // Calculate intent score based on event type
    const intentScore = calculateIntentScore(event.event_type, event.event_data);

    // If high intent and we have a phone number, store intent score
    if (lead && intentScore >= 50) {
      await leadService.scoreIntent(lead.id, {
        event_type: event.event_type,
        page_url: event.page_url,
        ...event.event_data,
      });
    }

    // Trigger Inngest job for high-intent events with phone number
    if (lead && event.phone && shouldTriggerCall(event.event_type, intentScore)) {
      logger.info(
        {
          leadId: lead.id,
          eventType: event.event_type,
          intentScore,
        },
        'High-intent event - triggering call via Inngest'
      );

      // Trigger Inngest job to initiate call
      await inngest.send({
        name: 'pixel-event/high-intent',
        data: {
          dealer_id: event.dealer_id,
          lead_id: lead.id,
          pixel_event_id: pixelEvent.id,
          intent_score: intentScore,
          event_type: event.event_type,
        },
      });
    }

    return c.json({
      success: true,
      pixel_event_id: pixelEvent.id,
      lead_id: lead?.id,
      intent_score: intentScore,
      will_trigger_call: lead && event.phone && shouldTriggerCall(event.event_type, intentScore),
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      logger.warn({ error: error.errors }, 'Invalid pixel event');
      return c.json({ error: 'Invalid event data', details: error.errors }, 400);
    }

    logger.error({ error }, 'Error processing pixel event');
    return c.json({ error: 'Internal server error' }, 500);
  }
});

/**
 * Calculate intent score based on event type and data
 */
function calculateIntentScore(eventType: string, eventData: Record<string, unknown>): number {
  const scores: Record<string, number> = {
    page_view: 10,
    vehicle_view: 30,
    form_started: 50,
    form_submitted: 80,
    payment_calculator: 60,
    trade_in_tool: 70,
    finance_preapproval: 90,
    test_drive_request: 95,
  };

  let baseScore = scores[eventType] || 0;

  // Boost score for certain data signals
  if (eventData.time_on_page && (eventData.time_on_page as number) > 120) {
    baseScore += 10;
  }

  if (eventData.return_visit) {
    baseScore += 15;
  }

  if (eventData.vehicle_saves && (eventData.vehicle_saves as number) > 0) {
    baseScore += 20;
  }

  return Math.min(baseScore, 100);
}

/**
 * Determine if event should trigger a call
 */
function shouldTriggerCall(eventType: string, intentScore: number): boolean {
  // High-intent events that should trigger calls
  const triggerEvents = [
    'form_submitted',
    'finance_preapproval',
    'test_drive_request',
    'trade_in_tool',
  ];

  // Trigger if:
  // 1. Event type is high-intent, OR
  // 2. Intent score is very high (>= 70)
  return triggerEvents.includes(eventType) || intentScore >= 70;
}
