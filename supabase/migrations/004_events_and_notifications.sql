-- Migration: 004_events_and_notifications.sql
-- Pixel events, notifications, messages, and opt-outs

-- Pixel events (Super Pixel ingestion)
CREATE TABLE pixel_events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  dealer_id UUID NOT NULL REFERENCES dealers(id) ON DELETE CASCADE,
  lead_id UUID REFERENCES leads(id) ON DELETE SET NULL,

  event_type TEXT NOT NULL, -- 'page_view', 'form_submit', 'vehicle_view', etc.
  event_data JSONB NOT NULL,

  -- Identity hints for resolution
  phone TEXT,
  email TEXT,
  cookie_id TEXT,
  ip_address INET,
  user_agent TEXT,

  -- Context
  page_url TEXT,
  referrer TEXT,

  received_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  processed_at TIMESTAMPTZ,

  metadata JSONB DEFAULT '{}'::jsonb
);

CREATE INDEX idx_pixel_events_dealer ON pixel_events(dealer_id, received_at DESC);
CREATE INDEX idx_pixel_events_lead ON pixel_events(lead_id, received_at DESC) WHERE lead_id IS NOT NULL;
CREATE INDEX idx_pixel_events_unprocessed ON pixel_events(dealer_id, received_at)
  WHERE processed_at IS NULL;

-- Notifications (internal alerts)
CREATE TABLE notifications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  dealer_id UUID NOT NULL REFERENCES dealers(id) ON DELETE CASCADE,
  user_id UUID REFERENCES dealer_users(id) ON DELETE CASCADE,

  notification_type TEXT NOT NULL CHECK (notification_type IN
    ('transfer_ready', 'missed_transfer', 'appointment_set', 'high_intent_lead', 'call_failed')
  ),

  title TEXT NOT NULL,
  message TEXT NOT NULL,

  related_lead_id UUID REFERENCES leads(id),
  related_call_id UUID REFERENCES call_sessions(id),

  status TEXT NOT NULL DEFAULT 'unread' CHECK (status IN ('unread', 'read', 'archived')),

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_notifications_user ON notifications(user_id, status, created_at DESC);
CREATE INDEX idx_notifications_dealer ON notifications(dealer_id, created_at DESC);

-- Message logs (SMS/email tracking)
CREATE TABLE message_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  dealer_id UUID NOT NULL REFERENCES dealers(id) ON DELETE CASCADE,
  lead_id UUID NOT NULL REFERENCES leads(id) ON DELETE CASCADE,

  message_type TEXT NOT NULL CHECK (message_type IN ('sms', 'email', 'call')),
  direction TEXT NOT NULL CHECK (direction IN ('inbound', 'outbound')),

  from_address TEXT NOT NULL, -- Phone or email
  to_address TEXT NOT NULL,

  subject TEXT, -- For emails
  body TEXT NOT NULL,

  -- Provider details
  provider TEXT, -- 'twilio', 'sendgrid', etc.
  provider_message_id TEXT,

  status TEXT NOT NULL DEFAULT 'sent' CHECK (status IN ('sent', 'delivered', 'failed', 'bounced')),

  sent_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  delivered_at TIMESTAMPTZ,

  metadata JSONB DEFAULT '{}'::jsonb
);

CREATE INDEX idx_message_logs_lead ON message_logs(lead_id, sent_at DESC);
CREATE INDEX idx_message_logs_dealer ON message_logs(dealer_id, sent_at DESC);

-- Opt-outs (TCPA compliance)
CREATE TABLE opt_outs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  dealer_id UUID NOT NULL REFERENCES dealers(id) ON DELETE CASCADE,

  phone TEXT, -- E.164
  email TEXT,

  opt_out_type TEXT NOT NULL CHECK (opt_out_type IN ('sms', 'call', 'email', 'all')),
  opted_out_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  reason TEXT,

  CONSTRAINT opt_out_has_identifier CHECK (phone IS NOT NULL OR email IS NOT NULL)
);

CREATE INDEX idx_opt_outs_phone ON opt_outs(dealer_id, phone) WHERE phone IS NOT NULL;
CREATE INDEX idx_opt_outs_email ON opt_outs(dealer_id, email) WHERE email IS NOT NULL;
