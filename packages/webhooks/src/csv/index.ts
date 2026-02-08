/**
 * CSV Import Webhook Handler
 *
 * Handles CSV file imports for pixel customer data with:
 * - EventData parsing to extract vehicle interests
 * - Skip trace enrichment
 * - Credit rating mapping
 * - API endpoints for both file upload and JSON data
 */

import { Hono } from 'hono';
import { z } from 'zod';
import { CsvImportService, type CsvPixelRow } from '@dealerbdc/core';
import { logger } from '@dealerbdc/shared';

export const csvRouter = new Hono();

// CSV row schema validation
const CsvPixelRowSchema = z.object({
  HemSha256: z.string().min(1),
  EventTimestamp: z.string(),
  EventType: z.string(),
  ActivityStartDate: z.string().optional(),
  ActivityEndDate: z.string().optional(),
  EventData: z.string(), // JSON string
  FIRST_NAME: z.string().optional(),
  'Last name': z.string().optional(),
  PERSONAL_CITY: z.string().optional(),
  PERSONAL_STATE: z.string().optional(),
  PERSONAL_ZIP: z.string().optional(),
  'personal email': z.string().optional(),
  mobile_PHONE: z.string().optional(),
  SKIPTRACE_CREDIT_RATING: z.string().optional(),
});

const CsvImportRequestSchema = z.object({
  dealer_id: z.string().uuid(),
  source: z.string().default('api'),
  file_name: z.string().optional(),
  skip_duplicates: z.boolean().default(true),
  rows: z.array(CsvPixelRowSchema).min(1),
});

/**
 * POST /webhooks/csv/import
 *
 * Import pixel customer data from CSV
 *
 * Request body:
 * {
 *   "dealer_id": "uuid",
 *   "source": "api|upload|s3",
 *   "file_name": "pixel_customers.csv",
 *   "skip_duplicates": true,
 *   "rows": [
 *     {
 *       "HemSha256": "...",
 *       "EventTimestamp": "2025-11-14T22:41:13Z",
 *       "EventType": "page_view",
 *       "EventData": "{\"url\": \"...\", ...}",
 *       ...
 *     }
 *   ]
 * }
 */
csvRouter.post('/import', async (c) => {
  try {
    const body = await c.req.json();

    // Validate request
    const request = CsvImportRequestSchema.parse(body);

    logger.info(
      {
        dealerId: request.dealer_id,
        rowCount: request.rows.length,
        source: request.source,
      },
      'CSV import requested'
    );

    const csvImportService = new CsvImportService();

    // Import data
    const result = await csvImportService.importPixelData(request.rows as CsvPixelRow[], {
      dealerId: request.dealer_id,
      source: request.source,
      fileName: request.file_name,
      skipDuplicates: request.skip_duplicates,
    });

    logger.info(
      {
        importId: result.importId,
        totalRows: result.totalRows,
        processedRows: result.processedRows,
        failedRows: result.failedRows,
      },
      'CSV import completed'
    );

    return c.json({
      success: true,
      import_id: result.importId,
      total_rows: result.totalRows,
      processed_rows: result.processedRows,
      failed_rows: result.failedRows,
      skipped_rows: result.skippedRows,
      errors: result.errors,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      logger.warn({ error: error.errors }, 'Invalid CSV import request');
      return c.json(
        {
          error: 'Invalid request data',
          details: error.errors,
        },
        400
      );
    }

    logger.error({ error }, 'Error processing CSV import');
    return c.json({ error: 'Internal server error' }, 500);
  }
});

/**
 * POST /webhooks/csv/fetch-and-import
 *
 * Fetch CSV from external URL and import
 *
 * Request body:
 * {
 *   "dealer_id": "uuid",
 *   "url": "https://example.com/pixel_data.csv",
 *   "skip_duplicates": true
 * }
 */
csvRouter.post('/fetch-and-import', async (c) => {
  try {
    const body = await c.req.json();

    const schema = z.object({
      dealer_id: z.string().uuid(),
      url: z.string().url(),
      skip_duplicates: z.boolean().default(true),
    });

    const request = schema.parse(body);

    logger.info(
      {
        dealerId: request.dealer_id,
        url: request.url,
      },
      'Fetching CSV from URL'
    );

    // Fetch CSV data from URL
    const response = await fetch(request.url);
    if (!response.ok) {
      return c.json(
        {
          error: 'Failed to fetch CSV',
          status: response.status,
          statusText: response.statusText,
        },
        400
      );
    }

    const csvText = await response.text();

    // Parse CSV (simple implementation - could use a CSV parser library)
    const rows = parseCsvText(csvText);

    logger.info({ rowCount: rows.length }, 'CSV fetched and parsed');

    // Validate rows
    const validatedRows = rows.map((row) => CsvPixelRowSchema.parse(row));

    // Import
    const csvImportService = new CsvImportService();
    const result = await csvImportService.importPixelData(validatedRows as CsvPixelRow[], {
      dealerId: request.dealer_id,
      source: 'api_fetch',
      fileName: new URL(request.url).pathname.split('/').pop(),
      skipDuplicates: request.skip_duplicates,
    });

    return c.json({
      success: true,
      import_id: result.importId,
      total_rows: result.totalRows,
      processed_rows: result.processedRows,
      failed_rows: result.failedRows,
      errors: result.errors,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      logger.warn({ error: error.errors }, 'Invalid CSV fetch request or CSV data');
      return c.json(
        {
          error: 'Invalid request or CSV data',
          details: error.errors,
        },
        400
      );
    }

    logger.error({ error }, 'Error fetching and importing CSV');
    return c.json({ error: 'Internal server error' }, 500);
  }
});

/**
 * GET /webhooks/csv/imports/:importId
 *
 * Get CSV import status
 */
csvRouter.get('/imports/:importId', async (c) => {
  try {
    const importId = c.req.param('importId');

    const { db, csvImports } = await import('@dealerbdc/database');
    const { eq } = await import('drizzle-orm');

    const [csvImport] = await db
      .select()
      .from(csvImports)
      .where(eq(csvImports.id, importId))
      .limit(1);

    if (!csvImport) {
      return c.json({ error: 'Import not found' }, 404);
    }

    return c.json({
      import_id: csvImport.id,
      dealer_id: csvImport.dealerId,
      status: csvImport.status,
      total_rows: csvImport.totalRows,
      processed_rows: csvImport.processedRows,
      failed_rows: csvImport.failedRows,
      started_at: csvImport.startedAt,
      completed_at: csvImport.completedAt,
      errors: csvImport.errorLog,
    });
  } catch (error) {
    logger.error({ error }, 'Error fetching CSV import status');
    return c.json({ error: 'Internal server error' }, 500);
  }
});

/**
 * Simple CSV parser
 * For production, consider using a library like 'csv-parse' or 'papaparse'
 */
function parseCsvText(csvText: string): Record<string, string>[] {
  const lines = csvText.trim().split('\n');
  if (lines.length < 2) return [];

  // Parse header row
  const headers = lines[0].split(',').map((h) => h.trim().replace(/^"|"$/g, ''));

  // Parse data rows
  const rows: Record<string, string>[] = [];
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    if (!line.trim()) continue;

    // Simple CSV parsing (doesn't handle quoted commas properly)
    // For production, use a proper CSV parser
    const values = line.split(',').map((v) => v.trim().replace(/^"|"$/g, ''));

    const row: Record<string, string> = {};
    for (let j = 0; j < headers.length; j++) {
      row[headers[j]] = values[j] || '';
    }

    rows.push(row);
  }

  return rows;
}
