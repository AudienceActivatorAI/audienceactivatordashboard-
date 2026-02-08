import { eq, and, or, sql } from 'drizzle-orm';
import {
  db,
  leads,
  leadIdentities,
  leadIntentScores,
  optOuts,
  type Database,
} from '@dealerbdc/database';
import {
  LeadNotFoundError,
  LeadOwnershipError,
  OptOutError,
  ValidationError,
  logger,
  phoneUtils,
  emailUtils,
} from '@dealerbdc/shared';

export interface CreateLeadInput {
  dealerId: string;
  storeId?: string;
  phone?: string;
  email?: string;
  firstName?: string;
  lastName?: string;
  department?: string;
  vehicleOfInterest?: string;
  source: string;
  sourceDetail?: string;
  metadata?: Record<string, unknown>;
}

export interface UpdateLeadInput {
  firstName?: string;
  lastName?: string;
  department?: string;
  vehicleOfInterest?: string;
  status?: string;
  assignedToUserId?: string;
  metadata?: Record<string, unknown>;
}

export interface IdentityResolutionInput {
  dealerId: string;
  phone?: string;
  email?: string;
  cookieId?: string;
  ipAddress?: string;
  deviceId?: string;
}

export class LeadService {
  constructor(private readonly database: Database = db) {}

  /**
   * Get lead by ID with full enrichment data
   */
  async getLead(leadId: string) {
    const lead = await this.database.query.leads.findFirst({
      where: eq(leads.id, leadId),
      with: {
        identities: true,
        intentScores: {
          orderBy: (scores, { desc }) => [desc(scores.scoredAt)],
          limit: 1,
        },
        vehicleInterests: {
          orderBy: (vehicles, { desc }) => [desc(vehicles.lastViewedAt)],
        },
        enrichment: true,
      },
    });

    if (!lead) {
      throw new LeadNotFoundError(leadId);
    }

    return lead;
  }

  /**
   * Find lead by phone number (within dealer)
   */
  async findLeadByPhone(dealerId: string, phone: string) {
    const normalizedPhone = phoneUtils.toE164(phone);

    const lead = await this.database.query.leads.findFirst({
      where: and(eq(leads.dealerId, dealerId), eq(leads.phone, normalizedPhone)),
    });

    return lead || null;
  }

  /**
   * Find lead by email (within dealer)
   */
  async findLeadByEmail(dealerId: string, email: string) {
    const normalizedEmail = emailUtils.normalize(email);

    const lead = await this.database.query.leads.findFirst({
      where: and(eq(leads.dealerId, dealerId), eq(leads.email, normalizedEmail)),
    });

    return lead || null;
  }

  /**
   * Resolve or create lead from identity hints
   * This is the key identity resolution function
   */
  async resolveOrCreateLead(input: IdentityResolutionInput & CreateLeadInput) {
    const { dealerId, phone, email, cookieId, ipAddress, deviceId, ...leadData } = input;

    // Normalize identifiers
    const normalizedPhone = phone ? phoneUtils.toE164(phone) : undefined;
    const normalizedEmail = email ? emailUtils.normalize(email) : undefined;

    // Try to find existing lead by strong identifiers (phone, email)
    let existingLead = null;

    if (normalizedPhone) {
      existingLead = await this.findLeadByPhone(dealerId, normalizedPhone);
    }

    if (!existingLead && normalizedEmail) {
      existingLead = await this.findLeadByEmail(dealerId, normalizedEmail);
    }

    // If found, update identities and return
    if (existingLead) {
      logger.info({ leadId: existingLead.id, dealerId }, 'Resolved existing lead');

      // Add new identities
      await this.addIdentities(existingLead.id, {
        phone: normalizedPhone,
        email: normalizedEmail,
        cookieId,
        ipAddress,
        deviceId,
      });

      // Update last activity
      await this.database
        .update(leads)
        .set({ lastActivityAt: new Date() })
        .where(eq(leads.id, existingLead.id));

      return existingLead;
    }

    // Create new lead
    logger.info({ dealerId, phone: normalizedPhone, email: normalizedEmail }, 'Creating new lead');

    const [newLead] = await this.database
      .insert(leads)
      .values({
        dealerId,
        storeId: leadData.storeId,
        phone: normalizedPhone,
        email: normalizedEmail,
        firstName: leadData.firstName,
        lastName: leadData.lastName,
        department: leadData.department,
        vehicleOfInterest: leadData.vehicleOfInterest,
        source: leadData.source,
        sourceDetail: leadData.sourceDetail,
        status: 'new',
        ownedBy: 'ai',
        metadata: leadData.metadata || {},
      })
      .returning();

    // Add identities
    await this.addIdentities(newLead.id, {
      phone: normalizedPhone,
      email: normalizedEmail,
      cookieId,
      ipAddress,
      deviceId,
    });

    return newLead;
  }

  /**
   * Add identities to a lead
   */
  private async addIdentities(
    leadId: string,
    identities: {
      phone?: string;
      email?: string;
      cookieId?: string;
      ipAddress?: string;
      deviceId?: string;
    }
  ) {
    const identityRecords = [];

    if (identities.phone) {
      identityRecords.push({
        leadId,
        identityType: 'phone' as const,
        identityValue: identities.phone,
        confidence: 100,
      });
    }

    if (identities.email) {
      identityRecords.push({
        leadId,
        identityType: 'email' as const,
        identityValue: identities.email,
        confidence: 100,
      });
    }

    if (identities.cookieId) {
      identityRecords.push({
        leadId,
        identityType: 'cookie' as const,
        identityValue: identities.cookieId,
        confidence: 80,
      });
    }

    if (identities.ipAddress) {
      identityRecords.push({
        leadId,
        identityType: 'ip' as const,
        identityValue: identities.ipAddress,
        confidence: 50,
      });
    }

    if (identities.deviceId) {
      identityRecords.push({
        leadId,
        identityType: 'device_id' as const,
        identityValue: identities.deviceId,
        confidence: 90,
      });
    }

    if (identityRecords.length === 0) {
      return;
    }

    // Insert identities, ignore conflicts (unique constraint)
    try {
      await this.database.insert(leadIdentities).values(identityRecords).onConflictDoNothing();
    } catch (error) {
      logger.warn({ leadId, error }, 'Failed to insert some identities (likely duplicates)');
    }
  }

  /**
   * Update lead
   */
  async updateLead(leadId: string, input: UpdateLeadInput) {
    const lead = await this.getLead(leadId);

    const [updated] = await this.database
      .update(leads)
      .set({
        ...input,
        updatedAt: new Date(),
      })
      .where(eq(leads.id, leadId))
      .returning();

    logger.info({ leadId, updates: input }, 'Lead updated');

    return updated;
  }

  /**
   * Update lead status
   */
  async updateStatus(leadId: string, status: string) {
    const validStatuses = [
      'new',
      'contacted',
      'qualified',
      'appointment_set',
      'transferred',
      'sold',
      'lost',
      'nurture',
    ];

    if (!validStatuses.includes(status)) {
      throw new ValidationError(`Invalid lead status: ${status}`, { status, validStatuses });
    }

    return this.updateLead(leadId, { status });
  }

  /**
   * Transfer lead to human (change ownership)
   */
  async transferToHuman(leadId: string, userId: string) {
    const lead = await this.getLead(leadId);

    if (lead.ownedBy === 'human') {
      throw new LeadOwnershipError(leadId, 'Lead is already owned by human');
    }

    const [updated] = await this.database
      .update(leads)
      .set({
        ownedBy: 'human',
        assignedToUserId: userId,
        transferredAt: new Date(),
        status: 'transferred',
        updatedAt: new Date(),
      })
      .where(eq(leads.id, leadId))
      .returning();

    logger.info({ leadId, userId }, 'Lead transferred to human');

    return updated;
  }

  /**
   * Check if lead/phone is opted out
   */
  async isOptedOut(dealerId: string, phone: string, channel: 'call' | 'sms' | 'email' = 'call') {
    const normalizedPhone = phoneUtils.toE164(phone);

    const optOut = await this.database.query.optOuts.findFirst({
      where: and(
        eq(optOuts.dealerId, dealerId),
        eq(optOuts.phone, normalizedPhone),
        or(eq(optOuts.optOutType, channel), eq(optOuts.optOutType, 'all'))
      ),
    });

    return optOut !== null;
  }

  /**
   * Check if lead is opted out (throws if opted out)
   */
  async checkOptOut(dealerId: string, phone: string, channel: 'call' | 'sms' | 'email' = 'call') {
    const isOptedOut = await this.isOptedOut(dealerId, phone, channel);

    if (isOptedOut) {
      throw new OptOutError(dealerId, phone);
    }
  }

  /**
   * Add opt-out record
   */
  async addOptOut(
    dealerId: string,
    contact: { phone?: string; email?: string },
    type: 'call' | 'sms' | 'email' | 'all',
    reason?: string
  ) {
    if (!contact.phone && !contact.email) {
      throw new ValidationError('Must provide phone or email for opt-out');
    }

    const normalizedPhone = contact.phone ? phoneUtils.toE164(contact.phone) : undefined;
    const normalizedEmail = contact.email ? emailUtils.normalize(contact.email) : undefined;

    await this.database.insert(optOuts).values({
      dealerId,
      phone: normalizedPhone,
      email: normalizedEmail,
      optOutType: type,
      reason,
    });

    logger.info({ dealerId, phone: normalizedPhone, email: normalizedEmail, type }, 'Opt-out added');
  }

  /**
   * Calculate and store intent score
   */
  async scoreIntent(leadId: string, factors: Record<string, unknown>) {
    // Simple scoring algorithm (can be enhanced)
    let score = 0;

    // Page views (max 20 points)
    const pageViews = (factors.page_views as number) || 0;
    score += Math.min(pageViews * 4, 20);

    // Time on site in seconds (max 20 points)
    const timeOnSite = (factors.time_on_site as number) || 0;
    score += Math.min(Math.floor(timeOnSite / 30), 20);

    // Vehicle views (max 30 points)
    const vehicleViews = (factors.vehicle_views as number) || 0;
    score += Math.min(vehicleViews * 10, 30);

    // Form interactions (30 points)
    if (factors.form_submit) score += 30;
    else if (factors.form_started) score += 15;

    // Cap at 100
    score = Math.min(score, 100);

    await this.database.insert(leadIntentScores).values({
      leadId,
      score,
      factors,
    });

    logger.info({ leadId, score, factors }, 'Intent score calculated');

    return score;
  }

  /**
   * Get latest intent score for lead
   */
  async getLatestIntentScore(leadId: string) {
    const [score] = await this.database.query.leadIntentScores.findMany({
      where: eq(leadIntentScores.leadId, leadId),
      orderBy: (scores, { desc }) => [desc(scores.scoredAt)],
      limit: 1,
    });

    return score || null;
  }
}
