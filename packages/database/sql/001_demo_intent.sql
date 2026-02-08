-- Demo schema for In-Market + High-Intent Vehicle Shoppers

create table if not exists raw_import (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null,
  first_name text not null,
  last_name text not null,
  personal_verified_emails text,
  business_verified_emails text,
  email_primary text,
  mobile_phone text,
  personal_city text not null,
  personal_state text not null,
  personal_zip text not null,
  skiptrace_credit_rating text not null,
  skiptrace_match_score int not null,
  skiptrace_ip inet,
  vehicle_make text not null,
  vehicle_model text not null,
  model_year int not null,
  assignment_method text,
  source_file text,
  created_at timestamptz not null
);

create index if not exists idx_raw_import_customer on raw_import (customer_id);
create index if not exists idx_raw_import_geo on raw_import (personal_state, personal_city, personal_zip);
create index if not exists idx_raw_import_vehicle on raw_import (vehicle_make, vehicle_model, model_year);
create index if not exists idx_raw_import_created on raw_import (created_at);

create table if not exists dim_geo (
  id uuid primary key default gen_random_uuid(),
  state text not null,
  city text not null,
  zip text not null,
  unique (state, city, zip)
);

create index if not exists idx_dim_geo_state on dim_geo (state);
create index if not exists idx_dim_geo_city on dim_geo (state, city);
create index if not exists idx_dim_geo_zip on dim_geo (zip);

create table if not exists dim_vehicle (
  id uuid primary key default gen_random_uuid(),
  make text not null,
  model text not null,
  model_year int not null,
  unique (make, model, model_year)
);

create index if not exists idx_dim_vehicle_make on dim_vehicle (make);
create index if not exists idx_dim_vehicle_model on dim_vehicle (make, model);
create index if not exists idx_dim_vehicle_year on dim_vehicle (model_year);

create table if not exists fact_shopper (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null,
  geo_id uuid not null references dim_geo(id),
  vehicle_id uuid not null references dim_vehicle(id),
  created_at timestamptz not null,
  credit_rating text not null,
  match_score int not null,
  intent_score int not null,
  intent_tier text not null,
  demo_multiplier_bucket int not null,
  demo_weight int not null,
  masked_email text,
  masked_phone text,
  sample_tag text
);

create index if not exists idx_fact_shopper_customer on fact_shopper (customer_id);
create index if not exists idx_fact_shopper_geo on fact_shopper (geo_id);
create index if not exists idx_fact_shopper_vehicle on fact_shopper (vehicle_id);
create index if not exists idx_fact_shopper_intent on fact_shopper (intent_tier, intent_score);
create index if not exists idx_fact_shopper_created on fact_shopper (created_at);
create index if not exists idx_fact_shopper_credit on fact_shopper (credit_rating);

create table if not exists daily_state_agg (
  date date not null,
  state text not null,
  identified_shoppers int not null,
  high_intent_shoppers int not null,
  avg_intent_score int not null,
  opportunity_index int not null,
  warm_shoppers int not null,
  hot_shoppers int not null,
  superhot_shoppers int not null
);

create index if not exists idx_daily_state_date on daily_state_agg (date, state);

create table if not exists daily_city_agg (
  date date not null,
  state text not null,
  city text not null,
  identified_shoppers int not null,
  high_intent_shoppers int not null,
  avg_intent_score int not null,
  opportunity_index int not null,
  warm_shoppers int not null,
  hot_shoppers int not null,
  superhot_shoppers int not null
);

create index if not exists idx_daily_city_date on daily_city_agg (date, state, city);

create table if not exists daily_zip_agg (
  date date not null,
  state text not null,
  city text not null,
  zip text not null,
  identified_shoppers int not null,
  high_intent_shoppers int not null,
  avg_intent_score int not null,
  opportunity_index int not null,
  warm_shoppers int not null,
  hot_shoppers int not null,
  superhot_shoppers int not null
);

create index if not exists idx_daily_zip_date on daily_zip_agg (date, state, city, zip);
