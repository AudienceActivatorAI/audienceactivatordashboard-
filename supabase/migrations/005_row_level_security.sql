-- Migration: 005_row_level_security.sql
-- Enable RLS and create policies for multi-tenant isolation

-- Enable RLS on all tables
ALTER TABLE dealers ENABLE ROW LEVEL SECURITY;
ALTER TABLE stores ENABLE ROW LEVEL SECURITY;
ALTER TABLE dealer_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE dealer_numbers ENABLE ROW LEVEL SECURITY;
ALTER TABLE dealer_calling_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE routing_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE lead_identities ENABLE ROW LEVEL SECURITY;
ALTER TABLE lead_intent_scores ENABLE ROW LEVEL SECURITY;
ALTER TABLE call_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE call_attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE transcripts ENABLE ROW LEVEL SECURITY;
ALTER TABLE call_summaries ENABLE ROW LEVEL SECURITY;
ALTER TABLE pixel_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE message_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE opt_outs ENABLE ROW LEVEL SECURITY;

-- Create service role bypass (for server-side operations)
-- Service role can access all data
DO $$
DECLARE
  tbl TEXT;
  tbl_array TEXT[] := ARRAY[
    'dealers', 'stores', 'dealer_users', 'dealer_numbers', 'dealer_calling_profiles',
    'routing_rules', 'leads', 'lead_identities', 'lead_intent_scores',
    'call_sessions', 'call_attempts', 'transcripts', 'call_summaries',
    'pixel_events', 'notifications', 'message_logs', 'opt_outs'
  ];
BEGIN
  FOREACH tbl IN ARRAY tbl_array
  LOOP
    EXECUTE format('
      CREATE POLICY service_role_all ON %I
      FOR ALL
      TO service_role
      USING (true)
      WITH CHECK (true)
    ', tbl);
  END LOOP;
END $$;

-- User-level policies (for future dashboard)
-- Authenticated users can only see data for their dealer_id

-- Example: Leads policy for authenticated dealer users
CREATE POLICY dealer_user_leads ON leads
FOR SELECT
TO authenticated
USING (
  dealer_id IN (
    SELECT dealer_id FROM dealer_users
    WHERE id = (current_setting('request.jwt.claims', true)::json->>'user_id')::uuid
  )
);

-- Example: Call sessions policy for authenticated dealer users
CREATE POLICY dealer_user_call_sessions ON call_sessions
FOR SELECT
TO authenticated
USING (
  dealer_id IN (
    SELECT dealer_id FROM dealer_users
    WHERE id = (current_setting('request.jwt.claims', true)::json->>'user_id')::uuid
  )
);

-- Example: Notifications policy - users can only see their own notifications
CREATE POLICY dealer_user_notifications ON notifications
FOR SELECT
TO authenticated
USING (
  user_id = (current_setting('request.jwt.claims', true)::json->>'user_id')::uuid
);

-- Note: Additional policies will be added as the dashboard is built
-- For now, all server-side operations use the service role which bypasses RLS
