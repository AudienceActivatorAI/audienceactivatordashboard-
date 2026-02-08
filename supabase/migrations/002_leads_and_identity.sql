-- Migration: 002_leads_and_identity.sql
-- Leads, identity resolution, and intent scoring

-- Leads (canonical lead record)
CREATE TABLE leads (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  dealer_id UUID NOT NULL REFERENCES dealers(id) ON DELETE CASCADE,
  store_id UUID REFERENCES stores(id) ON DELETE SET NULL,

  -- Identity (canonical values)
  phone TEXT, -- E.164 format
  email TEXT,
  first_name TEXT,
  last_name TEXT,

  -- Lead details
  department TEXT CHECK (department IN ('new', 'used', 'service', 'parts', 'finance')),
  vehicle_of_interest TEXT, -- e.g., "2024 Honda Accord"

  source TEXT, -- 'website', 'facebook', 'google', etc.
  source_detail TEXT, -- URL or campaign ID

  -- Status
  status TEXT NOT NULL DEFAULT 'new' CHECK (status IN
    ('new', 'contacted', 'qualified', 'appointment_set', 'transferred', 'sold', 'lost', 'nurture')
  ),

  -- Ownership
  owned_by TEXT NOT NULL DEFAULT 'ai' CHECK (owned_by IN ('ai', 'human')),
  assigned_to_user_id UUID REFERENCES dealer_users(id) ON DELETE SET NULL,
  transferred_at TIMESTAMPTZ,

  -- Timestamps
  first_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_contacted_at TIMESTAMPTZ,
  last_activity_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  metadata JSONB DEFAULT '{}'::jsonb
);

CREATE INDEX idx_leads_dealer ON leads(dealer_id);
CREATE INDEX idx_leads_dealer_status ON leads(dealer_id, status);
CREATE INDEX idx_leads_phone ON leads(phone) WHERE phone IS NOT NULL;
CREATE INDEX idx_leads_email ON leads(email) WHERE email IS NOT NULL;
CREATE INDEX idx_leads_owned_by ON leads(dealer_id, owned_by, status);

-- Lead identities (all identifiers we've seen for a lead)
CREATE TABLE lead_identities (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  lead_id UUID NOT NULL REFERENCES leads(id) ON DELETE CASCADE,

  identity_type TEXT NOT NULL CHECK (identity_type IN ('phone', 'email', 'cookie', 'ip', 'device_id')),
  identity_value TEXT NOT NULL,

  confidence NUMERIC(3,2) DEFAULT 1.0 CHECK (confidence >= 0 AND confidence <= 1),

  first_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT unique_lead_identity UNIQUE (lead_id, identity_type, identity_value)
);

CREATE INDEX idx_lead_identities_lead ON lead_identities(lead_id);
CREATE INDEX idx_lead_identities_lookup ON lead_identities(identity_type, identity_value);

-- Intent scores (real-time lead scoring)
CREATE TABLE lead_intent_scores (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  lead_id UUID NOT NULL REFERENCES leads(id) ON DELETE CASCADE,

  score INTEGER NOT NULL CHECK (score >= 0 AND score <= 100),
  factors JSONB NOT NULL, -- {page_views: 5, form_submit: true, time_on_site: 180}

  scored_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_intent_scores_lead ON lead_intent_scores(lead_id, scored_at DESC);
CREATE INDEX idx_intent_scores_high ON lead_intent_scores(lead_id, score) WHERE score >= 70;
