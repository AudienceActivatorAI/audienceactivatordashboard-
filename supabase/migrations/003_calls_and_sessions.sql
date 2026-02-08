-- Migration: 003_calls_and_sessions.sql
-- Call sessions, attempts, transcripts, and summaries

-- Call sessions (a complete call lifecycle)
CREATE TABLE call_sessions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  dealer_id UUID NOT NULL REFERENCES dealers(id) ON DELETE CASCADE,
  lead_id UUID NOT NULL REFERENCES leads(id) ON DELETE CASCADE,

  -- SignalWire
  signalwire_call_sid TEXT UNIQUE,
  from_number TEXT NOT NULL, -- Dealer's outbound number
  to_number TEXT NOT NULL, -- Lead's number

  -- SWAIG (SignalWire AI Gateway)
  swaig_session_id TEXT UNIQUE,
  swaig_agent_id TEXT,

  -- Session state
  status TEXT NOT NULL DEFAULT 'initiated' CHECK (status IN
    ('initiated', 'ringing', 'answered', 'in_progress', 'transferred', 'completed', 'failed', 'no_answer', 'busy', 'voicemail')
  ),

  -- Outcome
  outcome TEXT CHECK (outcome IN
    ('qualified', 'not_interested', 'callback_requested', 'transferred', 'appointment_set', 'voicemail_left', 'no_answer', 'wrong_number')
  ),

  -- Timing
  initiated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  answered_at TIMESTAMPTZ,
  ended_at TIMESTAMPTZ,
  duration_seconds INTEGER,

  -- Transfer details
  transferred_to_user_id UUID REFERENCES dealer_users(id),
  transfer_completed BOOLEAN DEFAULT false,

  -- Recording
  recording_url TEXT,
  recording_duration INTEGER,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  metadata JSONB DEFAULT '{}'::jsonb
);

CREATE INDEX idx_call_sessions_dealer ON call_sessions(dealer_id);
CREATE INDEX idx_call_sessions_lead ON call_sessions(lead_id, initiated_at DESC);
CREATE INDEX idx_call_sessions_signalwire ON call_sessions(signalwire_call_sid) WHERE signalwire_call_sid IS NOT NULL;
CREATE INDEX idx_call_sessions_swaig ON call_sessions(swaig_session_id) WHERE swaig_session_id IS NOT NULL;

-- Call attempts (tracks retry logic)
CREATE TABLE call_attempts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  dealer_id UUID NOT NULL REFERENCES dealers(id) ON DELETE CASCADE,
  lead_id UUID NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  call_session_id UUID REFERENCES call_sessions(id) ON DELETE SET NULL,

  attempt_number INTEGER NOT NULL,

  status TEXT NOT NULL CHECK (status IN ('pending', 'calling', 'completed', 'failed', 'scheduled')),
  scheduled_for TIMESTAMPTZ,
  attempted_at TIMESTAMPTZ,

  failure_reason TEXT,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT unique_lead_attempt UNIQUE (lead_id, attempt_number)
);

CREATE INDEX idx_call_attempts_lead ON call_attempts(lead_id, attempt_number);
CREATE INDEX idx_call_attempts_scheduled ON call_attempts(dealer_id, scheduled_for)
  WHERE status = 'scheduled' AND scheduled_for IS NOT NULL;

-- Transcripts (conversation transcript)
CREATE TABLE transcripts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  call_session_id UUID NOT NULL REFERENCES call_sessions(id) ON DELETE CASCADE,

  full_transcript TEXT NOT NULL,
  turns JSONB NOT NULL, -- [{role: 'ai', text: '...', timestamp: '...'}, ...]

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_transcripts_call ON transcripts(call_session_id);

-- Call summaries (AI-generated summary)
CREATE TABLE call_summaries (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  call_session_id UUID NOT NULL REFERENCES call_sessions(id) ON DELETE CASCADE,

  summary TEXT NOT NULL,
  key_points JSONB, -- ['Interested in 2024 Accord', 'Prefers weekday appointments']
  sentiment TEXT CHECK (sentiment IN ('positive', 'neutral', 'negative')),

  -- Qualification data
  qualification_data JSONB, -- {budget: '30k-40k', timeline: 'this_month', trade_in: true}

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_call_summaries_call ON call_summaries(call_session_id);
