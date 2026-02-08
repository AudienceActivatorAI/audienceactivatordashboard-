-- Migration: 001_core_multi_tenant_foundation.sql
-- Core tables for multi-tenant dealer management

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Dealers table (top-level tenant)
CREATE TABLE dealers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  legal_name TEXT,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'suspended', 'trial', 'churned')),

  -- Timezone for calling windows
  timezone TEXT NOT NULL DEFAULT 'America/New_York',

  -- Subscription
  plan_tier TEXT NOT NULL DEFAULT 'trial' CHECK (plan_tier IN ('trial', 'starter', 'growth', 'enterprise')),
  trial_ends_at TIMESTAMPTZ,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Metadata
  metadata JSONB DEFAULT '{}'::jsonb
);

CREATE INDEX idx_dealers_status ON dealers(status) WHERE status = 'active';

-- Stores (rooftops/locations under a dealer)
CREATE TABLE stores (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  dealer_id UUID NOT NULL REFERENCES dealers(id) ON DELETE CASCADE,

  name TEXT NOT NULL,
  address_street TEXT,
  address_city TEXT,
  address_state TEXT,
  address_zip TEXT,

  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive')),

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  metadata JSONB DEFAULT '{}'::jsonb
);

CREATE INDEX idx_stores_dealer ON stores(dealer_id);
CREATE INDEX idx_stores_dealer_active ON stores(dealer_id, status) WHERE status = 'active';

-- Dealer users (sales reps, managers, BDC agents)
CREATE TABLE dealer_users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  dealer_id UUID NOT NULL REFERENCES dealers(id) ON DELETE CASCADE,
  store_id UUID REFERENCES stores(id) ON DELETE SET NULL,

  email TEXT NOT NULL,
  phone TEXT,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,

  role TEXT NOT NULL CHECK (role IN ('bdc_agent', 'sales_rep', 'manager', 'admin')),
  department TEXT CHECK (department IN ('new', 'used', 'service', 'parts', 'finance')),

  -- Transfer eligibility
  accepts_transfers BOOLEAN NOT NULL DEFAULT true,
  transfer_priority INTEGER DEFAULT 0, -- Higher = preferred

  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'dnd')),

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  metadata JSONB DEFAULT '{}'::jsonb,

  CONSTRAINT unique_dealer_user_email UNIQUE (dealer_id, email)
);

CREATE INDEX idx_dealer_users_dealer ON dealer_users(dealer_id);
CREATE INDEX idx_dealer_users_store ON dealer_users(store_id);
CREATE INDEX idx_dealer_users_transfer ON dealer_users(dealer_id, accepts_transfers, status)
  WHERE accepts_transfers = true AND status = 'active';

-- Dealer phone numbers (SignalWire numbers for outbound calling)
CREATE TABLE dealer_numbers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  dealer_id UUID NOT NULL REFERENCES dealers(id) ON DELETE CASCADE,
  store_id UUID REFERENCES stores(id) ON DELETE SET NULL,

  phone_number TEXT NOT NULL UNIQUE, -- E.164 format
  signalwire_sid TEXT NOT NULL UNIQUE,

  number_type TEXT NOT NULL CHECK (number_type IN ('local', 'toll_free')),
  purpose TEXT NOT NULL DEFAULT 'outbound' CHECK (purpose IN ('outbound', 'inbound', 'both')),

  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive')),

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  metadata JSONB DEFAULT '{}'::jsonb
);

CREATE INDEX idx_dealer_numbers_dealer ON dealer_numbers(dealer_id);
CREATE INDEX idx_dealer_numbers_active ON dealer_numbers(dealer_id, status) WHERE status = 'active';

-- Dealer calling profiles (controls when/how AI calls)
CREATE TABLE dealer_calling_profiles (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  dealer_id UUID NOT NULL REFERENCES dealers(id) ON DELETE CASCADE,

  -- Calling windows (UTC time ranges)
  calling_hours_start TIME NOT NULL DEFAULT '08:00:00', -- Local time
  calling_hours_end TIME NOT NULL DEFAULT '20:00:00',
  calling_days_of_week INTEGER[] NOT NULL DEFAULT ARRAY[1,2,3,4,5,6], -- 0=Sun, 6=Sat

  -- Rate limiting
  max_concurrent_calls INTEGER NOT NULL DEFAULT 3,
  max_calls_per_hour INTEGER NOT NULL DEFAULT 50,
  max_attempts_per_lead INTEGER NOT NULL DEFAULT 3,

  -- Retry timing
  retry_delay_minutes INTEGER[] NOT NULL DEFAULT ARRAY[30, 120, 1440], -- 30min, 2hr, 24hr

  -- Compliance
  honor_dnc BOOLEAN NOT NULL DEFAULT true,
  require_consent BOOLEAN NOT NULL DEFAULT true,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX idx_dealer_calling_profiles_dealer ON dealer_calling_profiles(dealer_id);

-- Routing rules (deterministic routing logic)
CREATE TABLE routing_rules (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  dealer_id UUID NOT NULL REFERENCES dealers(id) ON DELETE CASCADE,
  store_id UUID REFERENCES stores(id) ON DELETE CASCADE,

  name TEXT NOT NULL,
  priority INTEGER NOT NULL DEFAULT 0, -- Higher = evaluated first

  -- Conditions (all must match)
  conditions JSONB NOT NULL, -- {department: 'new', source: 'website', intent_score: {min: 70}}

  -- Routing target
  route_to_type TEXT NOT NULL CHECK (route_to_type IN ('user', 'team', 'department', 'voicemail')),
  route_to_id UUID, -- user_id or null for department routing

  fallback_rule_id UUID REFERENCES routing_rules(id),

  active BOOLEAN NOT NULL DEFAULT true,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_routing_rules_dealer ON routing_rules(dealer_id, priority DESC) WHERE active = true;
CREATE INDEX idx_routing_rules_store ON routing_rules(store_id, priority DESC) WHERE active = true;
