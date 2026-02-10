import express from 'express';
import cors from 'cors';
import { sql } from 'drizzle-orm';
import { createDbConnection } from '@dealerbdc/database';
import { dataDictionary, demoAssumptions, metricDefinitions, scoringRules } from './codex.js';

const app = express();
app.use(cors());
app.use(express.json());

const db = createDbConnection();

const getRows = <T extends Record<string, unknown>>(result: unknown): T[] => {
  if (Array.isArray(result)) return result as T[];
  if (result && typeof result === 'object' && 'rows' in result) {
    return (result as { rows: T[] }).rows ?? [];
  }
  return [];
};

type Filters = {
  dateFrom: string;
  dateTo: string;
  state?: string;
  city?: string;
  zip?: string;
  make?: string;
  model?: string;
  yearBand?: string;
  creditRating?: string;
};

const parseDateRange = (query: Record<string, string | undefined>) => {
  const today = new Date();
  const defaultTo = today.toISOString().slice(0, 10);
  const defaultFrom = new Date(today.getTime() - 29 * 24 * 60 * 60 * 1000)
    .toISOString()
    .slice(0, 10);
  return {
    dateFrom: query.date_from ?? defaultFrom,
    dateTo: query.date_to ?? defaultTo,
  };
};

const buildFilters = (query: Record<string, string | undefined>): Filters => {
  const { dateFrom, dateTo } = parseDateRange(query);
  return {
    dateFrom,
    dateTo,
    state: query.state || undefined,
    city: query.city || undefined,
    zip: query.zip || undefined,
    make: query.make || undefined,
    model: query.model || undefined,
    yearBand: query.model_year_band || undefined,
    creditRating: query.credit_rating || undefined,
  };
};

const modelYearBandSql = (yearBand?: string) => {
  if (!yearBand) return null;
  if (yearBand === '2015-2019') return sql`v.model_year between 2015 and 2019`;
  if (yearBand === '2020-2022') return sql`v.model_year between 2020 and 2022`;
  if (yearBand === '2023-2024') return sql`v.model_year between 2023 and 2024`;
  if (yearBand === '2025+') return sql`v.model_year >= 2025`;
  return null;
};

const buildFactWhere = (filters: Filters) => {
  const clauses = [
    sql`f.created_at::date between ${filters.dateFrom}::date and ${filters.dateTo}::date`,
  ];
  if (filters.state) clauses.push(sql`g.state = ${filters.state}`);
  if (filters.city) clauses.push(sql`g.city = ${filters.city}`);
  if (filters.zip) clauses.push(sql`g.zip = ${filters.zip}`);
  if (filters.make) clauses.push(sql`v.make = ${filters.make}`);
  if (filters.model) clauses.push(sql`v.model = ${filters.model}`);
  if (filters.creditRating) clauses.push(sql`f.credit_rating = ${filters.creditRating}`);
  const yearClause = modelYearBandSql(filters.yearBand);
  if (yearClause) clauses.push(yearClause);
  return clauses.length ? sql`where ${sql.join(clauses, sql` and `)}` : sql``;
};

const buildAggWhere = (filters: Filters) => {
  const clauses = [
    sql`date between ${filters.dateFrom}::date and ${filters.dateTo}::date`,
  ];
  if (filters.state) clauses.push(sql`state = ${filters.state}`);
  if (filters.city) clauses.push(sql`city = ${filters.city}`);
  if (filters.zip) clauses.push(sql`zip = ${filters.zip}`);
  return clauses.length ? sql`where ${sql.join(clauses, sql` and `)}` : sql``;
};

app.get('/api/overview', async (req, res) => {
  const filters = buildFilters(req.query as Record<string, string | undefined>);
  const usesFactFilters = Boolean(
    filters.make || filters.model || filters.yearBand || filters.creditRating
  );
  const scope = filters.zip
    ? 'zip'
    : filters.city
      ? 'city'
      : 'state';

  const aggTable =
    scope === 'zip'
      ? sql`daily_zip_agg`
      : scope === 'city'
        ? sql`daily_city_agg`
        : sql`daily_state_agg`;

  const whereAgg = buildAggWhere(filters);
  const totals = usesFactFilters
    ? await db.execute(sql`
        select
          sum(f.demo_weight)::int as identified_shoppers,
          sum(case when f.intent_score >= 60 then f.demo_weight else 0 end)::int as high_intent_shoppers,
          round(avg(f.intent_score))::int as avg_intent_score,
          round(
            avg(f.intent_score) * 0.6
            + (sum(case when f.intent_score >= 60 then f.demo_weight else 0 end)::numeric / nullif(sum(f.demo_weight), 0)) * 100 * 0.4
          )::int as opportunity_index,
          sum(case when f.intent_tier = 'Warm' then f.demo_weight else 0 end)::int as warm_shoppers,
          sum(case when f.intent_tier = 'Hot' then f.demo_weight else 0 end)::int as hot_shoppers,
          sum(case when f.intent_tier = 'SuperHot' then f.demo_weight else 0 end)::int as superhot_shoppers
        from fact_shopper f
        join dim_geo g on g.id = f.geo_id
        join dim_vehicle v on v.id = f.vehicle_id
        ${buildFactWhere(filters)}
      `)
    : await db.execute(sql`
    select
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
      sum(both_reachable)::int as both_reachable
    from ${aggTable}
    ${whereAgg}
  `);

  const trend = usesFactFilters
    ? await db.execute(sql`
        select
          f.created_at::date as date,
          sum(f.demo_weight)::int as identified_shoppers,
          sum(case when f.intent_score >= 60 then f.demo_weight else 0 end)::int as high_intent_shoppers,
          round(avg(f.intent_score))::int as avg_intent_score,
          round(
            avg(f.intent_score) * 0.6
            + (sum(case when f.intent_score >= 60 then f.demo_weight else 0 end)::numeric / nullif(sum(f.demo_weight), 0)) * 100 * 0.4
          )::int as opportunity_index
        from fact_shopper f
        join dim_geo g on g.id = f.geo_id
        join dim_vehicle v on v.id = f.vehicle_id
        ${buildFactWhere(filters)}
        group by date
        order by date
      `)
    : await db.execute(sql`
    select
      date::date as date,
      sum(identified_shoppers)::int as identified_shoppers,
      sum(high_intent_shoppers)::int as high_intent_shoppers,
      round(avg(avg_intent_score))::int as avg_intent_score,
      round(avg(opportunity_index))::int as opportunity_index,
      sum(contactable_shoppers)::int as contactable_shoppers
    from ${aggTable}
    ${whereAgg}
    group by date
    order by date
  `);

  const samples = await db.execute(sql`
    select
      f.masked_email,
      f.masked_phone,
      g.city,
      g.state,
      g.zip,
      v.make,
      v.model,
      v.model_year,
      f.intent_score,
      f.intent_tier,
      f.created_at::date as created_at
    from fact_shopper f
    join dim_geo g on g.id = f.geo_id
    join dim_vehicle v on v.id = f.vehicle_id
    ${buildFactWhere(filters)}
    and f.sample_tag = 'demo'
    order by f.created_at desc
    limit 10
  `);

  const totalsRow = getRows<Record<string, number>>(totals)[0] ?? {};

  res.json({
    kpis: {
      identifiedShoppers: totalsRow.identified_shoppers ?? 0,
      highIntentShoppers: totalsRow.high_intent_shoppers ?? 0,
      avgIntentScore: totalsRow.avg_intent_score ?? 0,
      opportunityIndex: totalsRow.opportunity_index ?? 0,
      contactableShoppers: totalsRow.contactable_shoppers ?? 0,
      emailReachable: totalsRow.email_reachable ?? 0,
      phoneReachable: totalsRow.phone_reachable ?? 0,
      bothReachable: totalsRow.both_reachable ?? 0,
    },
    segments: {
      warm: totalsRow.warm_shoppers ?? 0,
      hot: totalsRow.hot_shoppers ?? 0,
      superhot: totalsRow.superhot_shoppers ?? 0,
    },
    trend: getRows<Record<string, string>>(trend),
    samples: getRows<Record<string, string>>(samples),
  });
});

app.get('/api/geo/state', async (req, res) => {
  const filters = buildFilters(req.query as Record<string, string | undefined>);
  const usesFactFilters = Boolean(
    filters.make || filters.model || filters.yearBand || filters.creditRating
  );
  const whereAgg = buildAggWhere(filters);
  const result = usesFactFilters
    ? await db.execute(sql`
        select
          g.state,
          sum(f.demo_weight)::int as identified_shoppers,
          sum(case when f.intent_score >= 60 then f.demo_weight else 0 end)::int as high_intent_shoppers,
          round(avg(f.intent_score))::int as avg_intent_score,
          round(
            avg(f.intent_score) * 0.6
            + (sum(case when f.intent_score >= 60 then f.demo_weight else 0 end)::numeric / nullif(sum(f.demo_weight), 0)) * 100 * 0.4
          )::int as opportunity_index
        from fact_shopper f
        join dim_geo g on g.id = f.geo_id
        join dim_vehicle v on v.id = f.vehicle_id
        ${buildFactWhere(filters)}
        group by g.state
        order by identified_shoppers desc
      `)
    : await db.execute(sql`
        select
          state,
          sum(identified_shoppers)::int as identified_shoppers,
          sum(high_intent_shoppers)::int as high_intent_shoppers,
          round(avg(avg_intent_score))::int as avg_intent_score,
          round(avg(opportunity_index))::int as opportunity_index,
          sum(contactable_shoppers)::int as contactable_shoppers,
          sum(email_reachable)::int as email_reachable,
          sum(phone_reachable)::int as phone_reachable,
          sum(both_reachable)::int as both_reachable,
          round(avg(median_home_value))::int as median_home_value
        from daily_state_agg
        ${whereAgg}
        group by state
        order by identified_shoppers desc
      `);
  res.json({ rows: getRows<Record<string, string>>(result) });
});

app.get('/api/geo/city', async (req, res) => {
  const filters = buildFilters(req.query as Record<string, string | undefined>);
  if (!filters.state) {
    res.status(400).json({ error: 'state is required' });
    return;
  }
  const usesFactFilters = Boolean(
    filters.make || filters.model || filters.yearBand || filters.creditRating
  );
  const whereAgg = buildAggWhere(filters);
  const result = usesFactFilters
    ? await db.execute(sql`
        select
          g.city,
          g.state,
          sum(f.demo_weight)::int as identified_shoppers,
          sum(case when f.intent_score >= 60 then f.demo_weight else 0 end)::int as high_intent_shoppers,
          round(avg(f.intent_score))::int as avg_intent_score,
          round(
            avg(f.intent_score) * 0.6
            + (sum(case when f.intent_score >= 60 then f.demo_weight else 0 end)::numeric / nullif(sum(f.demo_weight), 0)) * 100 * 0.4
          )::int as opportunity_index
        from fact_shopper f
        join dim_geo g on g.id = f.geo_id
        join dim_vehicle v on v.id = f.vehicle_id
        ${buildFactWhere(filters)}
        group by g.state, g.city
        order by identified_shoppers desc
      `)
    : await db.execute(sql`
        select
          city,
          state,
          sum(identified_shoppers)::int as identified_shoppers,
          sum(high_intent_shoppers)::int as high_intent_shoppers,
          round(avg(avg_intent_score))::int as avg_intent_score,
          round(avg(opportunity_index))::int as opportunity_index,
          sum(contactable_shoppers)::int as contactable_shoppers,
          sum(email_reachable)::int as email_reachable,
          sum(phone_reachable)::int as phone_reachable,
          sum(both_reachable)::int as both_reachable,
          round(avg(median_home_value))::int as median_home_value
        from daily_city_agg
        ${whereAgg}
        group by state, city
        order by identified_shoppers desc
      `);
  res.json({ rows: getRows<Record<string, string>>(result) });
});

app.get('/api/geo/zip', async (req, res) => {
  const filters = buildFilters(req.query as Record<string, string | undefined>);
  if (!filters.state || !filters.city) {
    res.status(400).json({ error: 'state and city are required' });
    return;
  }
  const usesFactFilters = Boolean(
    filters.make || filters.model || filters.yearBand || filters.creditRating
  );
  const whereAgg = buildAggWhere(filters);
  const result = usesFactFilters
    ? await db.execute(sql`
        select
          g.zip,
          g.city,
          g.state,
          sum(f.demo_weight)::int as identified_shoppers,
          sum(case when f.intent_score >= 60 then f.demo_weight else 0 end)::int as high_intent_shoppers,
          round(avg(f.intent_score))::int as avg_intent_score,
          round(
            avg(f.intent_score) * 0.6
            + (sum(case when f.intent_score >= 60 then f.demo_weight else 0 end)::numeric / nullif(sum(f.demo_weight), 0)) * 100 * 0.4
          )::int as opportunity_index
        from fact_shopper f
        join dim_geo g on g.id = f.geo_id
        join dim_vehicle v on v.id = f.vehicle_id
        ${buildFactWhere(filters)}
        group by g.state, g.city, g.zip
        order by identified_shoppers desc
      `)
    : await db.execute(sql`
        select
          zip,
          city,
          state,
          sum(identified_shoppers)::int as identified_shoppers,
          sum(high_intent_shoppers)::int as high_intent_shoppers,
          round(avg(avg_intent_score))::int as avg_intent_score,
          round(avg(opportunity_index))::int as opportunity_index,
          sum(contactable_shoppers)::int as contactable_shoppers,
          sum(email_reachable)::int as email_reachable,
          sum(phone_reachable)::int as phone_reachable,
          sum(both_reachable)::int as both_reachable,
          round(avg(median_home_value))::int as median_home_value
        from daily_zip_agg
        ${whereAgg}
        group by state, city, zip
        order by identified_shoppers desc
      `);
  res.json({ rows: getRows<Record<string, string>>(result) });
});

app.get('/api/vehicles/top', async (req, res) => {
  const filters = buildFilters(req.query as Record<string, string | undefined>);
  const whereFact = buildFactWhere(filters);
  const result = await db.execute(sql`
    select
      v.make,
      v.model,
      v.model_year,
      sum(f.demo_weight)::int as shopper_count,
      round(avg(f.intent_score))::int as avg_intent_score
    from fact_shopper f
    join dim_vehicle v on v.id = f.vehicle_id
    join dim_geo g on g.id = f.geo_id
    ${whereFact}
    group by v.make, v.model, v.model_year
    order by shopper_count desc
    limit 20
  `);
  res.json({ rows: getRows<Record<string, string>>(result) });
});

app.get('/api/filters', async (_req, res) => {
  const statesResult = await db.execute(sql`
    select distinct state from dim_geo order by state
  `);
  const makesResult = await db.execute(sql`
    select distinct make from dim_vehicle order by make
  `);
  const modelsResult = await db.execute(sql`
    select distinct model from dim_vehicle order by model
  `);
  const states = getRows<{ state: string }>(statesResult);
  const makes = getRows<{ make: string }>(makesResult);
  const models = getRows<{ model: string }>(modelsResult);
  res.json({
    states: states.map((r) => r.state),
    makes: makes.map((r) => r.make),
    models: models.map((r) => r.model),
    yearBands: ['2015-2019', '2020-2022', '2023-2024', '2025+'],
    creditRatings: ['A', 'B', 'C', 'D', 'E'],
  });
});

app.get('/api/codex', (_req, res) => {
  res.json({
    dataDictionary,
    metricDefinitions,
    demoAssumptions,
    scoringRules,
  });
});

app.get('/health', (_req, res) => {
  res.json({ ok: true });
});

const port = Number(process.env.PORT ?? 4000);
app.listen(port, () => {
  console.log(`API listening on ${port}`);
});
