-- Seed data for development and testing
-- Creates a test dealer with users, routing rules, and sample data

-- Test dealer: ABC Motors
INSERT INTO dealers (id, name, legal_name, status, timezone, plan_tier, metadata)
VALUES (
  '00000000-0000-0000-0000-000000000001',
  'ABC Motors',
  'ABC Motors LLC',
  'active',
  'America/New_York',
  'trial',
  '{"test": true}'::jsonb
);

-- Test store: ABC Motors Main Location
INSERT INTO stores (id, dealer_id, name, address_city, address_state, status)
VALUES (
  '00000000-0000-0000-0000-000000000011',
  '00000000-0000-0000-0000-000000000001',
  'Main Location',
  'Charlotte',
  'NC',
  'active'
);

-- Test calling profile for ABC Motors
INSERT INTO dealer_calling_profiles (dealer_id, calling_hours_start, calling_hours_end, calling_days_of_week, max_concurrent_calls, max_calls_per_hour, max_attempts_per_lead)
VALUES (
  '00000000-0000-0000-0000-000000000001',
  '09:00:00',
  '20:00:00',
  ARRAY[1,2,3,4,5,6], -- Monday to Saturday
  5,
  100,
  3
);

-- Test dealer users
INSERT INTO dealer_users (id, dealer_id, store_id, email, phone, first_name, last_name, role, department, accepts_transfers, transfer_priority, status)
VALUES
  (
    '00000000-0000-0000-0000-000000000101',
    '00000000-0000-0000-0000-000000000001',
    '00000000-0000-0000-0000-000000000011',
    'john.smith@abcmotors.com',
    '+17045551234',
    'John',
    'Smith',
    'sales_rep',
    'new',
    true,
    10,
    'active'
  ),
  (
    '00000000-0000-0000-0000-000000000102',
    '00000000-0000-0000-0000-000000000001',
    '00000000-0000-0000-0000-000000000011',
    'sarah.jones@abcmotors.com',
    '+17045551235',
    'Sarah',
    'Jones',
    'sales_rep',
    'used',
    true,
    10,
    'active'
  ),
  (
    '00000000-0000-0000-0000-000000000103',
    '00000000-0000-0000-0000-000000000001',
    '00000000-0000-0000-0000-000000000011',
    'mike.manager@abcmotors.com',
    '+17045551236',
    'Mike',
    'Manager',
    'manager',
    'new',
    true,
    5,
    'active'
  );

-- Test dealer phone number
INSERT INTO dealer_numbers (dealer_id, store_id, phone_number, signalwire_sid, number_type, purpose, status)
VALUES (
  '00000000-0000-0000-0000-000000000001',
  '00000000-0000-0000-0000-000000000011',
  '+17045550000',
  'PNxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx',
  'local',
  'both',
  'active'
);

-- Test routing rules
-- Rule 1: New vehicle leads go to John Smith
INSERT INTO routing_rules (id, dealer_id, name, priority, conditions, route_to_type, route_to_id, active)
VALUES (
  '00000000-0000-0000-0000-000000000201',
  '00000000-0000-0000-0000-000000000001',
  'New Vehicle Leads',
  100,
  '{"department": "new"}'::jsonb,
  'user',
  '00000000-0000-0000-0000-000000000101',
  true
);

-- Rule 2: Used vehicle leads go to Sarah Jones
INSERT INTO routing_rules (id, dealer_id, name, priority, conditions, route_to_type, route_to_id, active)
VALUES (
  '00000000-0000-0000-0000-000000000202',
  '00000000-0000-0000-0000-000000000001',
  'Used Vehicle Leads',
  90,
  '{"department": "used"}'::jsonb,
  'user',
  '00000000-0000-0000-0000-000000000102',
  true
);

-- Rule 3: Fallback to manager
INSERT INTO routing_rules (id, dealer_id, name, priority, conditions, route_to_type, route_to_id, active)
VALUES (
  '00000000-0000-0000-0000-000000000203',
  '00000000-0000-0000-0000-000000000001',
  'Fallback to Manager',
  10,
  '{}'::jsonb,
  'user',
  '00000000-0000-0000-0000-000000000103',
  true
);

-- Test lead
INSERT INTO leads (id, dealer_id, store_id, phone, email, first_name, last_name, department, vehicle_of_interest, source, status, owned_by)
VALUES (
  '00000000-0000-0000-0000-000000000301',
  '00000000-0000-0000-0000-000000000001',
  '00000000-0000-0000-0000-000000000011',
  '+19195551234',
  'test.lead@example.com',
  'Test',
  'Lead',
  'new',
  '2024 Honda Accord',
  'website',
  'new',
  'ai'
);

-- Test lead identities
INSERT INTO lead_identities (lead_id, identity_type, identity_value, confidence)
VALUES
  ('00000000-0000-0000-0000-000000000301', 'phone', '+19195551234', 1.0),
  ('00000000-0000-0000-0000-000000000301', 'email', 'test.lead@example.com', 1.0);

-- Test intent score
INSERT INTO lead_intent_scores (lead_id, score, factors)
VALUES (
  '00000000-0000-0000-0000-000000000301',
  85,
  '{"page_views": 5, "form_submit": true, "time_on_site": 240, "vehicle_views": 3}'::jsonb
);
