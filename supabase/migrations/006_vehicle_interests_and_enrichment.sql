-- Migration: 006_vehicle_interests_and_enrichment.sql
-- Vehicle interests tracking and skip trace enrichment for CSV pixel data

-- Vehicle interests (track multiple vehicles viewed by a lead)
CREATE TABLE vehicle_interests (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  lead_id UUID NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  dealer_id UUID NOT NULL REFERENCES dealers(id) ON DELETE CASCADE,

  -- Vehicle details extracted from EventData URLs
  vehicle_year INTEGER,
  vehicle_make TEXT,
  vehicle_model TEXT,
  vehicle_vin TEXT,
  vehicle_stock_number TEXT,
  vehicle_url TEXT, -- Full URL from EventData

  -- Event context
  event_type TEXT, -- e.g., 'page_view', 'vehicle_view', etc.
  event_timestamp TIMESTAMPTZ, -- Timestamp from within EventData JSON

  -- Engagement metrics
  time_on_page INTEGER, -- Seconds spent on vehicle page
  interaction_count INTEGER DEFAULT 1, -- Number of times viewed

  -- Priority flag (determines which vehicle to address customer about)
  is_primary BOOLEAN DEFAULT false,

  -- Timestamps
  first_viewed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_viewed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  metadata JSONB DEFAULT '{}'::jsonb
);

CREATE INDEX idx_vehicle_interests_lead ON vehicle_interests(lead_id, last_viewed_at DESC);
CREATE INDEX idx_vehicle_interests_dealer ON vehicle_interests(dealer_id, created_at DESC);
CREATE INDEX idx_vehicle_interests_primary ON vehicle_interests(lead_id, is_primary) WHERE is_primary = true;
CREATE INDEX idx_vehicle_interests_vin ON vehicle_interests(vehicle_vin) WHERE vehicle_vin IS NOT NULL;

-- Lead enrichment data (skip trace and external data sources)
CREATE TABLE lead_enrichments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  lead_id UUID NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  dealer_id UUID NOT NULL REFERENCES dealers(id) ON DELETE CASCADE,

  -- Identity enrichment
  hem_sha256 TEXT, -- Hashed email identifier from pixel data

  -- Skip trace data
  skiptrace_credit_rating TEXT, -- Letter code: A, B, C, D, E, F, G, H, etc.
  credit_score_min INTEGER, -- Mapped from letter code (e.g., A=800)
  credit_score_max INTEGER, -- Mapped from letter code (e.g., A=850)

  -- Personal information from skip trace
  personal_city TEXT,
  personal_state TEXT,
  personal_zip TEXT,
  mobile_phone TEXT, -- E.164 format
  personal_email TEXT,

  -- Activity tracking from CSV
  activity_start_date TIMESTAMPTZ,
  activity_end_date TIMESTAMPTZ,

  -- Data source tracking
  enrichment_source TEXT DEFAULT 'csv_import', -- 'csv_import', 'api', 'manual'
  enrichment_provider TEXT, -- Provider name if applicable

  -- Data quality
  confidence_score NUMERIC(3,2) DEFAULT 1.0 CHECK (confidence_score >= 0 AND confidence_score <= 1),

  -- Timestamps
  enriched_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  metadata JSONB DEFAULT '{}'::jsonb,

  -- Constraints
  CONSTRAINT unique_lead_enrichment UNIQUE (lead_id)
);

CREATE INDEX idx_lead_enrichments_lead ON lead_enrichments(lead_id);
CREATE INDEX idx_lead_enrichments_hem ON lead_enrichments(hem_sha256) WHERE hem_sha256 IS NOT NULL;
CREATE INDEX idx_lead_enrichments_credit ON lead_enrichments(dealer_id, credit_score_min DESC)
  WHERE credit_score_min IS NOT NULL;

-- CSV import tracking (track CSV file imports for idempotency)
CREATE TABLE csv_imports (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  dealer_id UUID NOT NULL REFERENCES dealers(id) ON DELETE CASCADE,

  -- Import metadata
  import_source TEXT NOT NULL, -- 'upload', 'api_fetch', 's3', etc.
  file_name TEXT,
  file_hash TEXT, -- SHA256 hash of file content for duplicate detection

  -- Processing stats
  total_rows INTEGER NOT NULL DEFAULT 0,
  processed_rows INTEGER NOT NULL DEFAULT 0,
  failed_rows INTEGER NOT NULL DEFAULT 0,
  skipped_rows INTEGER NOT NULL DEFAULT 0,

  -- Status
  status TEXT NOT NULL DEFAULT 'processing' CHECK (status IN
    ('processing', 'completed', 'failed', 'partially_completed')
  ),

  -- Error tracking
  error_log JSONB DEFAULT '[]'::jsonb,

  -- Timestamps
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  metadata JSONB DEFAULT '{}'::jsonb
);

CREATE INDEX idx_csv_imports_dealer ON csv_imports(dealer_id, created_at DESC);
CREATE INDEX idx_csv_imports_status ON csv_imports(dealer_id, status) WHERE status = 'processing';
CREATE INDEX idx_csv_imports_hash ON csv_imports(file_hash) WHERE file_hash IS NOT NULL;

-- Add HemSha256 to lead_identities for tracking pixel identifier
-- This allows us to link CSV data to existing leads via HemSha256
-- (No migration needed - we can use existing lead_identities table with identity_type='hem_sha256')
