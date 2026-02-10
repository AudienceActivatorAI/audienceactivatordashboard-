#!/usr/bin/env tsx

import fs from 'node:fs';
import path from 'node:path';
import https from 'node:https';
import { pipeline } from 'node:stream/promises';
import { parse } from 'csv-parse';
import { Client } from 'pg';
import { from as copyFrom } from 'pg-copy-streams';

const ZHVI_URL =
  'https://files.zillowstatic.com/research/public_csvs/zhvi/Zip_zhvi_uc_sfrcondo_tier_0.33_0.67_sm_sa_month.csv';

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  console.error('DATABASE_URL environment variable is not set');
  process.exit(1);
}

const downloadFile = async (url: string, dest: string) => {
  await new Promise<void>((resolve, reject) => {
    https
      .get(url, (res) => {
        if (res.statusCode && res.statusCode >= 400) {
          reject(new Error(`Failed to download: ${res.statusCode}`));
          return;
        }
        const fileStream = fs.createWriteStream(dest);
        res.pipe(fileStream);
        fileStream.on('finish', () => fileStream.close(() => resolve()));
        fileStream.on('error', reject);
      })
      .on('error', reject);
  });
};

const run = async () => {
  const tmpDir = '/tmp';
  const rawPath = path.join(tmpDir, 'zhvi_zip.csv');
  const normalizedPath = path.join(tmpDir, 'zhvi_zip_latest.csv');

  console.log('⬇️ Downloading Zillow ZHVI ZIP dataset...');
  await downloadFile(ZHVI_URL, rawPath);

  console.log('🧹 Normalizing to latest value per ZIP...');
  const parser = fs
    .createReadStream(rawPath)
    .pipe(parse({ columns: true, skip_empty_lines: true }));

  const output = fs.createWriteStream(normalizedPath);
  output.write('zip,zhvi,as_of\n');

  let latestDateKey: string | null = null;

  for await (const record of parser) {
    if (!latestDateKey) {
      const dateKeys = Object.keys(record).filter((key) => /^\d{4}-\d{2}-\d{2}$/.test(key));
      latestDateKey = dateKeys.sort().slice(-1)[0] ?? null;
    }
    if (!latestDateKey) continue;
    const zip = String(record.RegionName || '').trim();
    const value = String(record[latestDateKey] || '').trim();
    if (!zip || !value) continue;
    const zhvi = Math.round(Number(value));
    if (!Number.isFinite(zhvi)) continue;
    output.write(`${zip},${zhvi},${latestDateKey}\n`);
  }

  output.end();
  await new Promise<void>((resolve) => output.on('finish', () => resolve()));

  console.log('📥 Loading ZHVI into Postgres...');
  const client = new Client({ connectionString });
  await client.connect();

  try {
    await client.query('truncate dim_zip_home_value;');
    const stream = client.query(
      copyFrom('copy dim_zip_home_value (zip, zhvi, as_of) from stdin with csv header')
    );
    await pipeline(fs.createReadStream(normalizedPath), stream);
    console.log('✅ ZHVI loaded');
  } finally {
    await client.end();
  }
};

run().catch((error) => {
  console.error('❌ ZHVI load failed:', error);
  process.exit(1);
});
