/**
 * Inngest Client Configuration
 *
 * Initialize Inngest client for background job processing
 */

import { Inngest, EventSchemas } from 'inngest';

// Define event schemas for type safety
type Events = {
  'pixel-event/high-intent': {
    data: {
      dealer_id: string;
      lead_id: string;
      pixel_event_id: string;
      intent_score: number;
      event_type: string;
    };
  };
  'call/transcript-ready': {
    data: {
      call_session_id: string;
      dealer_id: string;
      lead_id: string;
    };
  };
  'call/transfer-completed': {
    data: {
      call_session_id: string;
      dealer_id: string;
      lead_id: string;
      user_id: string;
    };
  };
  'notification/send': {
    data: {
      dealer_id: string;
      user_id?: string;
      lead_id?: string;
      type: 'transfer_ready' | 'appointment_set' | 'high_intent_lead' | 'call_failed';
      title: string;
      message: string;
      channel: 'sms' | 'email' | 'both';
    };
  };
};

// Create Inngest client with event schemas
export const inngest = new Inngest({
  id: 'dealerbdc',
  schemas: new EventSchemas().fromRecord<Events>(),
});
