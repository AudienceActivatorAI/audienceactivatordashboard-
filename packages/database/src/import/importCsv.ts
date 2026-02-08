#!/usr/bin/env tsx

import fs from 'node:fs';
import path from 'node:path';
import { Client } from 'pg';
import { from as copyFrom } from 'pg-copy-streams';

const filePath = process.argv[2];

if (!filePath) {
  console.error('Usage: pnpm --filter @dealerbdc/database import:csv /path/to/file.csv');
  process.exit(1);
}

const resolvedPath = path.resolve(process.cwd(), filePath);

if (!fs.existsSync(resolvedPath)) {
  console.error(`CSV file not found: ${resolvedPath}`);
  process.exit(1);
}

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  console.error('DATABASE_URL environment variable is not set');
  process.exit(1);
}

const columns = [
  'customer_id',
  'first_name',
  'last_name',
  'personal_verified_emails',
  'business_verified_emails',
  'email_primary',
  'mobile_phone',
  'personal_city',
  'personal_state',
  'personal_zip',
  'skiptrace_credit_rating',
  'skiptrace_match_score',
  'skiptrace_ip',
  'vehicle_make',
  'vehicle_model',
  'model_year',
  'assignment_method',
  'source_file',
  'created_at',
].join(', ');

const run = async () => {
  const client = new Client({ connectionString });
  await client.connect();

  try {
    await client.query(`set datestyle to 'ISO, MDY'`);
    const stream = client.query(
      copyFrom(`copy raw_import (${columns}) from stdin with csv header`)
    );

    const fileStream = fs.createReadStream(resolvedPath);
    fileStream.pipe(stream);

    await new Promise<void>((resolve, reject) => {
      stream.on('finish', resolve);
      stream.on('error', reject);
      fileStream.on('error', reject);
    });

    console.log(`✅ Imported CSV: ${resolvedPath}`);
  } catch (error) {
    console.error('❌ CSV import failed:', error);
    process.exitCode = 1;
  } finally {
    await client.end();
  }
};

run();
