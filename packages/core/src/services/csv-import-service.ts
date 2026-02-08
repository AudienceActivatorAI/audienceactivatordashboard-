/**
 * CSV Import Service
 *
 * Handles importing pixel customer data from CSV files with:
 * - EventData parsing to extract vehicle interests
 * - Skip trace enrichment data
 * - Credit rating mapping
 * - Vehicle prioritization
 */

import { db, leads, leadIdentities, leadEnrichments, vehicleInterests, csvImports } from '@dealerbdc/database';
import { eq, and } from 'drizzle-orm';
import { logger } from '@dealerbdc/shared';
import {
  parseVehicleFromEventData,
  determinePrimaryVehicle,
  deduplicateVehicles,
  mapCreditRating,
  type VehicleInfo,
} from '@dealerbdc/shared';
import { LeadService } from './lead-service.js';
import crypto from 'crypto';

export interface CsvPixelRow {
  HemSha256: string;
  EventTimestamp: string;
  EventType: string;
  ActivityStartDate?: string;
  ActivityEndDate?: string;
  EventData: string; // JSON string
  FIRST_NAME?: string;
  'Last name'?: string;
  PERSONAL_CITY?: string;
  PERSONAL_STATE?: string;
  PERSONAL_ZIP?: string;
  'personal email'?: string;
  mobile_PHONE?: string;
  SKIPTRACE_CREDIT_RATING?: string;
}

export interface CsvImportOptions {
  dealerId: string;
  source: string; // 'upload', 'api', 's3', etc.
  fileName?: string;
  skipDuplicates?: boolean; // Skip if file hash already imported
}

export interface CsvImportResult {
  importId: string;
  totalRows: number;
  processedRows: number;
  failedRows: number;
  skippedRows: number;
  errors: Array<{ row: number; error: string }>;
}

export class CsvImportService {
  private leadService: LeadService;

  constructor() {
    this.leadService = new LeadService();
  }

  /**
   * Import pixel customer data from CSV rows
   *
   * @param rows - Array of CSV row objects
   * @param options - Import configuration
   * @returns Import result summary
   */
  async importPixelData(rows: CsvPixelRow[], options: CsvImportOptions): Promise<CsvImportResult> {
    const { dealerId, source, fileName, skipDuplicates = true } = options;

    // Calculate file hash for duplicate detection
    const fileContent = JSON.stringify(rows);
    const fileHash = crypto.createHash('sha256').update(fileContent).digest('hex');

    // Check for duplicate import
    if (skipDuplicates) {
      const [existingImport] = await db
        .select()
        .from(csvImports)
        .where(and(eq(csvImports.dealerId, dealerId), eq(csvImports.fileHash, fileHash)))
        .limit(1);

      if (existingImport) {
        logger.info(
          { importId: existingImport.id, fileHash },
          'CSV file already imported, skipping'
        );
        return {
          importId: existingImport.id,
          totalRows: existingImport.totalRows,
          processedRows: existingImport.processedRows,
          failedRows: existingImport.failedRows,
          skippedRows: rows.length,
          errors: [],
        };
      }
    }

    // Create import record
    const [csvImport] = await db
      .insert(csvImports)
      .values({
        dealerId,
        importSource: source,
        fileName,
        fileHash,
        totalRows: rows.length,
        status: 'processing',
      })
      .returning();

    logger.info(
      { importId: csvImport.id, totalRows: rows.length, dealerId },
      'Starting CSV import'
    );

    const errors: Array<{ row: number; error: string }> = [];
    let processedRows = 0;
    let failedRows = 0;

    // Group rows by HemSha256 to process each customer's data together
    const customerData = new Map<string, CsvPixelRow[]>();
    for (const row of rows) {
      if (!row.HemSha256) continue;
      const existing = customerData.get(row.HemSha256) || [];
      existing.push(row);
      customerData.set(row.HemSha256, existing);
    }

    // Process each customer
    for (const [hemSha256, customerRows] of customerData.entries()) {
      try {
        await this.processCustomerData(dealerId, hemSha256, customerRows);
        processedRows += customerRows.length;
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        logger.error(
          { hemSha256, error: errorMessage },
          'Failed to process customer data'
        );
        errors.push({
          row: rows.indexOf(customerRows[0]),
          error: errorMessage,
        });
        failedRows += customerRows.length;
      }
    }

    // Update import record
    const status =
      failedRows === 0 ? 'completed' : failedRows === rows.length ? 'failed' : 'partially_completed';

    await db
      .update(csvImports)
      .set({
        processedRows,
        failedRows,
        status,
        errorLog: errors,
        completedAt: new Date(),
      })
      .where(eq(csvImports.id, csvImport.id));

    logger.info(
      { importId: csvImport.id, processedRows, failedRows, status },
      'CSV import completed'
    );

    return {
      importId: csvImport.id,
      totalRows: rows.length,
      processedRows,
      failedRows,
      skippedRows: 0,
      errors,
    };
  }

  /**
   * Process all data for a single customer (HemSha256)
   */
  private async processCustomerData(
    dealerId: string,
    hemSha256: string,
    rows: CsvPixelRow[]
  ): Promise<void> {
    // Extract customer info from rows (use first non-empty value)
    const firstName = rows.find((r) => r.FIRST_NAME)?.FIRST_NAME;
    const lastName = rows.find((r) => r['Last name'])?.['Last name'];
    const email = rows.find((r) => r['personal email'])?.['personal email'];
    const phone = rows.find((r) => r.mobile_PHONE)?.mobile_PHONE;
    const city = rows.find((r) => r.PERSONAL_CITY)?.PERSONAL_CITY;
    const state = rows.find((r) => r.PERSONAL_STATE)?.PERSONAL_STATE;
    const zip = rows.find((r) => r.PERSONAL_ZIP)?.PERSONAL_ZIP;
    const creditRating = rows.find((r) => r.SKIPTRACE_CREDIT_RATING)?.SKIPTRACE_CREDIT_RATING;

    // Find or create lead
    let lead = await this.findLeadByHemSha256(dealerId, hemSha256);

    if (!lead && (email || phone)) {
      // Create new lead
      lead = await this.leadService.resolveOrCreateLead({
        dealerId,
        email,
        phone,
        firstName,
        lastName,
        source: 'csv_import',
        sourceDetail: 'pixel_customer_data',
      });

      // Add HemSha256 identity
      await db.insert(leadIdentities).values({
        leadId: lead.id,
        identityType: 'hem_sha256',
        identityValue: hemSha256,
        confidence: 100,
      });
    }

    if (!lead) {
      throw new Error(`Could not create lead for HemSha256: ${hemSha256}`);
    }

    // Extract vehicles from all rows
    const vehicles: VehicleInfo[] = [];
    for (const row of rows) {
      const vehicle = parseVehicleFromEventData(row.EventData);
      if (vehicle) {
        // Add event timestamp if not in EventData
        if (!vehicle.timestamp && row.EventTimestamp) {
          vehicle.timestamp = row.EventTimestamp;
        }
        vehicles.push(vehicle);
      }
    }

    // Deduplicate vehicles
    const uniqueVehicles = deduplicateVehicles(vehicles);

    // Determine primary vehicle
    const primaryVehicle = determinePrimaryVehicle(uniqueVehicles);

    // Store vehicle interests
    if (uniqueVehicles.length > 0) {
      await this.storeVehicleInterests(lead.id, dealerId, uniqueVehicles, primaryVehicle);
    }

    // Update lead with primary vehicle
    if (primaryVehicle) {
      const vehicleName = `${primaryVehicle.year || ''} ${primaryVehicle.make || ''} ${primaryVehicle.model || ''}`.trim();
      await db
        .update(leads)
        .set({
          vehicleOfInterest: vehicleName || undefined,
          updatedAt: new Date(),
        })
        .where(eq(leads.id, lead.id));
    }

    // Store enrichment data
    await this.storeEnrichmentData(lead.id, dealerId, {
      hemSha256,
      creditRating,
      personalCity: city,
      personalState: state,
      personalZip: zip,
      mobilePhone: phone,
      personalEmail: email,
      activityStartDate: rows.find((r) => r.ActivityStartDate)?.ActivityStartDate,
      activityEndDate: rows.find((r) => r.ActivityEndDate)?.ActivityEndDate,
    });

    logger.info(
      {
        leadId: lead.id,
        hemSha256,
        vehicleCount: uniqueVehicles.length,
        primaryVehicle: primaryVehicle ? `${primaryVehicle.year} ${primaryVehicle.make} ${primaryVehicle.model}` : null,
        creditRating,
      },
      'Processed customer data'
    );
  }

  /**
   * Find lead by HemSha256 identifier
   */
  private async findLeadByHemSha256(dealerId: string, hemSha256: string) {
    const [identity] = await db
      .select()
      .from(leadIdentities)
      .where(
        and(
          eq(leadIdentities.identityType, 'hem_sha256'),
          eq(leadIdentities.identityValue, hemSha256)
        )
      )
      .limit(1);

    if (!identity) return null;

    const [lead] = await db
      .select()
      .from(leads)
      .where(and(eq(leads.id, identity.leadId), eq(leads.dealerId, dealerId)))
      .limit(1);

    return lead || null;
  }

  /**
   * Store vehicle interests for a lead
   */
  private async storeVehicleInterests(
    leadId: string,
    dealerId: string,
    vehicles: VehicleInfo[],
    primaryVehicle: VehicleInfo | null
  ): Promise<void> {
    // Delete existing vehicle interests for this lead
    await db.delete(vehicleInterests).where(eq(vehicleInterests.leadId, leadId));

    // Insert new vehicle interests
    const vehicleRecords = vehicles.map((vehicle) => ({
      leadId,
      dealerId,
      vehicleYear: vehicle.year,
      vehicleMake: vehicle.make,
      vehicleModel: vehicle.model,
      vehicleVin: vehicle.vin,
      vehicleUrl: vehicle.url,
      eventTimestamp: vehicle.timestamp ? new Date(vehicle.timestamp) : undefined,
      isPrimary: primaryVehicle ? vehicle.url === primaryVehicle.url : false,
    }));

    if (vehicleRecords.length > 0) {
      await db.insert(vehicleInterests).values(vehicleRecords);
    }
  }

  /**
   * Store enrichment data for a lead
   */
  private async storeEnrichmentData(
    leadId: string,
    dealerId: string,
    data: {
      hemSha256: string;
      creditRating?: string;
      personalCity?: string;
      personalState?: string;
      personalZip?: string;
      mobilePhone?: string;
      personalEmail?: string;
      activityStartDate?: string;
      activityEndDate?: string;
    }
  ): Promise<void> {
    const creditScoreRange = data.creditRating ? mapCreditRating(data.creditRating) : undefined;

    // Upsert enrichment data
    const enrichmentData = {
      leadId,
      dealerId,
      hemSha256: data.hemSha256,
      skiptraceCreditRating: data.creditRating,
      creditScoreMin: creditScoreRange?.min,
      creditScoreMax: creditScoreRange?.max,
      personalCity: data.personalCity,
      personalState: data.personalState,
      personalZip: data.personalZip,
      mobilePhone: data.mobilePhone,
      personalEmail: data.personalEmail,
      activityStartDate: data.activityStartDate ? new Date(data.activityStartDate) : undefined,
      activityEndDate: data.activityEndDate ? new Date(data.activityEndDate) : undefined,
      enrichmentSource: 'csv_import' as const,
      updatedAt: new Date(),
    };

    // Check if enrichment exists
    const [existing] = await db
      .select()
      .from(leadEnrichments)
      .where(eq(leadEnrichments.leadId, leadId))
      .limit(1);

    if (existing) {
      await db
        .update(leadEnrichments)
        .set(enrichmentData)
        .where(eq(leadEnrichments.id, existing.id));
    } else {
      await db.insert(leadEnrichments).values(enrichmentData);
    }
  }
}
