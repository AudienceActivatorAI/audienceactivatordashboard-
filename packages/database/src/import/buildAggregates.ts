#!/usr/bin/env tsx

import postgres from 'postgres';
import { creditBonusByRating, demoWeightByBucket } from './deterministic.js';

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  console.error('DATABASE_URL environment variable is not set');
  process.exit(1);
}

const sql = postgres(connectionString, { max: 1 });

const run = async () => {
  console.log('🔄 Building dimensions and aggregates...');

  const creditCase = Object.entries(creditBonusByRating)
    .map(([rating, bonus]) => `when '${rating}' then ${bonus}`)
    .join(' ');

  const demoWeightCase = Object.entries(demoWeightByBucket)
    .map(([bucket, weight]) => `when ${bucket} then ${weight}`)
    .join(' ');

  await sql.unsafe(`
    insert into dim_geo (state, city, zip)
    select distinct
      upper(trim(personal_state)) as state,
      initcap(trim(personal_city)) as city,
      lpad(regexp_replace(personal_zip, '\\\\D', '', 'g'), 5, '0') as zip
    from raw_import
    on conflict (state, city, zip) do nothing;
  `);

  await sql.unsafe(`
    insert into dim_vehicle (make, model, model_year)
    select distinct
      initcap(trim(vehicle_make)) as make,
      initcap(trim(vehicle_model)) as model,
      model_year
    from raw_import
    on conflict (make, model, model_year) do nothing;
  `);

  await sql.unsafe(`truncate fact_shopper;`);

  await sql.unsafe(`
    insert into fact_shopper (
      customer_id,
      geo_id,
      vehicle_id,
      created_at,
      credit_rating,
      match_score,
      intent_score,
      intent_tier,
      demo_multiplier_bucket,
      demo_weight,
      has_email,
      has_phone,
      masked_email,
      masked_phone,
      sample_tag
    )
    select
      r.customer_id,
      g.id,
      v.id,
      r.created_at,
      r.skiptrace_credit_rating,
      r.skiptrace_match_score,
      least(
        100,
        greatest(
          0,
          (seed_int % 70)
          + floor(r.skiptrace_match_score / 8)
          + credit_bonus
        )
      )::int as intent_score,
      case
        when least(100, greatest(0, (seed_int % 70) + floor(r.skiptrace_match_score / 8) + credit_bonus)) >= 80 then 'SuperHot'
        when least(100, greatest(0, (seed_int % 70) + floor(r.skiptrace_match_score / 8) + credit_bonus)) >= 60 then 'Hot'
        when least(100, greatest(0, (seed_int % 70) + floor(r.skiptrace_match_score / 8) + credit_bonus)) >= 30 then 'Warm'
        else 'Warm'
      end as intent_tier,
      demo_bucket,
      case demo_bucket
        ${demoWeightCase}
        else 1
      end as demo_weight,
      case
        when (coalesce(r.email_primary, '') <> '' or coalesce(r.personal_verified_emails, '') <> '' or coalesce(r.business_verified_emails, '') <> '') then true
        else false
      end as has_email,
      case
        when (coalesce(r.mobile_phone, '') <> '') then true
        else false
      end as has_phone,
      case
        when r.email_primary is null then null
        else regexp_replace(r.email_primary, '^(.).*(@.+)$', '\\\\1***\\\\2')
      end as masked_email,
      case
        when r.mobile_phone is null then null
        else '(***)***-' || right(regexp_replace(r.mobile_phone, '\\\\D', '', 'g'), 4)
      end as masked_phone,
      'demo' as sample_tag
    from (
      select
        *,
        abs(('x' || substr(md5(customer_id::text || vehicle_make || vehicle_model || model_year::text || skiptrace_match_score::text || skiptrace_credit_rating), 1, 8))::bit(32)::int) as seed_int,
        abs(('x' || substr(md5(customer_id::text || 'demo_bucket'), 1, 8))::bit(32)::int) % 5 + 1 as demo_bucket,
        case upper(skiptrace_credit_rating)
          ${creditCase}
          else 0
        end as credit_bonus
      from raw_import
    ) r
    join dim_geo g
      on g.state = upper(trim(r.personal_state))
     and g.city = initcap(trim(r.personal_city))
     and g.zip = lpad(regexp_replace(r.personal_zip, '\\\\D', '', 'g'), 5, '0')
    join dim_vehicle v
      on v.make = initcap(trim(r.vehicle_make))
     and v.model = initcap(trim(r.vehicle_model))
     and v.model_year = r.model_year;
  `);

  await sql.unsafe(`truncate daily_zip_agg;`);
  await sql.unsafe(`truncate daily_city_agg;`);
  await sql.unsafe(`truncate daily_state_agg;`);

  await sql.unsafe(`
    insert into daily_zip_agg
    select
      (date_trunc('week', f.created_at)::date
        + (
          case
            when seed < 8 then 0       -- Mon 8%
            when seed < 18 then 1      -- Tue 10%
            when seed < 30 then 2      -- Wed 12%
            when seed < 48 then 3      -- Thu 18%
            when seed < 68 then 4      -- Fri 20%
            when seed < 88 then 5      -- Sat 20%
            else 6                     -- Sun 12%
          end
        ) * interval '1 day'
      )::date as date,
      g.state,
      g.city,
      g.zip,
      sum(f.demo_weight)::int as identified_shoppers,
      sum(case when f.intent_score >= 60 then f.demo_weight else 0 end)::int as high_intent_shoppers,
      round(sum(f.intent_score * f.demo_weight)::numeric / nullif(sum(f.demo_weight), 0))::int as avg_intent_score,
      round(
        (sum(f.intent_score * f.demo_weight)::numeric / nullif(sum(f.demo_weight), 0)) * 0.6
        + (sum(case when f.intent_score >= 60 then f.demo_weight else 0 end)::numeric / nullif(sum(f.demo_weight), 0)) * 100 * 0.4
      )::int as opportunity_index,
      sum(case when f.intent_tier = 'Warm' then f.demo_weight else 0 end)::int as warm_shoppers,
      sum(case when f.intent_tier = 'Hot' then f.demo_weight else 0 end)::int as hot_shoppers,
      sum(case when f.intent_tier = 'SuperHot' then f.demo_weight else 0 end)::int as superhot_shoppers,
      sum(case when f.has_email or f.has_phone then f.demo_weight else 0 end)::int as contactable_shoppers,
      sum(case when f.has_email then f.demo_weight else 0 end)::int as email_reachable,
      sum(case when f.has_phone then f.demo_weight else 0 end)::int as phone_reachable,
      sum(case when f.has_email and f.has_phone then f.demo_weight else 0 end)::int as both_reachable,
      coalesce(max(z.zhvi), 0)::int as median_home_value
    from (
      select
        f.*,
        abs(('x' || substr(md5(f.customer_id::text), 1, 8))::bit(32)::int) % 100 as seed
      from fact_shopper f
    ) f
    join dim_geo g on g.id = f.geo_id
    left join dim_zip_home_value z on z.zip = g.zip
    group by date, g.state, g.city, g.zip;
  `);

  await sql.unsafe(`
    insert into daily_city_agg
    select
      date,
      state,
      city,
      sum(identified_shoppers)::int as identified_shoppers,
      sum(high_intent_shoppers)::int as high_intent_shoppers,
      round(avg(avg_intent_score))::int as avg_intent_score,
      round(avg(opportunity_index))::int as opportunity_index,
      sum(warm_shoppers)::int as warm_shoppers,
      sum(hot_shoppers)::int as hot_shoppers,
      sum(superhot_shoppers)::int as superhot_shoppers,
      sum(contactable_shoppers)::int as contactable_shoppers,
      sum(email_reachable)::int as email_reachable,
      sum(phone_reachable)::int as phone_reachable,
      sum(both_reachable)::int as both_reachable,
      round(sum(median_home_value * identified_shoppers)::numeric / nullif(sum(identified_shoppers), 0))::int as median_home_value
    from daily_zip_agg
    group by date, state, city;
  `);

  await sql.unsafe(`
    insert into daily_state_agg
    select
      date,
      state,
      sum(identified_shoppers)::int as identified_shoppers,
      sum(high_intent_shoppers)::int as high_intent_shoppers,
      round(avg(avg_intent_score))::int as avg_intent_score,
      round(avg(opportunity_index))::int as opportunity_index,
      sum(warm_shoppers)::int as warm_shoppers,
      sum(hot_shoppers)::int as hot_shoppers,
      sum(superhot_shoppers)::int as superhot_shoppers,
      sum(contactable_shoppers)::int as contactable_shoppers,
      sum(email_reachable)::int as email_reachable,
      sum(phone_reachable)::int as phone_reachable,
      sum(both_reachable)::int as both_reachable,
      round(sum(median_home_value * identified_shoppers)::numeric / nullif(sum(identified_shoppers), 0))::int as median_home_value
    from daily_city_agg
    group by date, state;
  `);

  console.log('✅ Aggregates built');
};

run()
  .catch((error) => {
    console.error('❌ Aggregate build failed:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await sql.end();
  });
