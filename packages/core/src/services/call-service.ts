import { eq, and, desc, sql } from 'drizzle-orm';
import {
  db,
  callSessions,
  callAttempts,
  transcripts,
  callSummaries,
  type Database,
} from '@dealerbdc/database';
import { MaxAttemptsError, logger } from '@dealerbdc/shared';
import { DealerService } from './dealer-service.js';

export interface CreateCallSessionInput {
  dealerId: string;
  leadId: string;
  fromNumber: string;
  toNumber: string;
  swaigSessionId?: string;
  swaigAgentId?: string;
  metadata?: Record<string, unknown>;
}

export interface UpdateCallSessionInput {
  signalwireCallSid?: string;
  status?: string;
  outcome?: string;
  answeredAt?: Date;
  endedAt?: Date;
  durationSeconds?: number;
  transferredToUserId?: string;
  transferCompleted?: boolean;
  recordingUrl?: string;
  recordingDuration?: number;
  metadata?: Record<string, unknown>;
}

export class CallService {
  private dealerService: DealerService;

  constructor(private readonly database: Database = db) {
    this.dealerService = new DealerService(database);
  }

  /**
   * Get call session by ID
   */
  async getCallSession(callSessionId: string) {
    const session = await this.database.query.callSessions.findFirst({
      where: eq(callSessions.id, callSessionId),
      with: {
        lead: true,
        dealer: true,
      },
    });

    return session || null;
  }

  /**
   * Get call session by SWAIG session ID
   */
  async getCallSessionBySwaigId(swaigSessionId: string) {
    const session = await this.database.query.callSessions.findFirst({
      where: eq(callSessions.swaigSessionId, swaigSessionId),
    });

    return session || null;
  }

  /**
   * Get call session by SignalWire call SID
   */
  async getCallSessionBySignalwireSid(signalwireCallSid: string) {
    const session = await this.database.query.callSessions.findFirst({
      where: eq(callSessions.signalwireCallSid, signalwireCallSid),
    });

    return session || null;
  }

  /**
   * Create new call session
   */
  async createCallSession(input: CreateCallSessionInput) {
    const [session] = await this.database
      .insert(callSessions)
      .values({
        dealerId: input.dealerId,
        leadId: input.leadId,
        fromNumber: input.fromNumber,
        toNumber: input.toNumber,
        swaigSessionId: input.swaigSessionId,
        swaigAgentId: input.swaigAgentId,
        status: 'initiated',
        metadata: input.metadata || {},
      })
      .returning();

    logger.info(
      {
        callSessionId: session.id,
        dealerId: input.dealerId,
        leadId: input.leadId,
        swaigSessionId: input.swaigSessionId,
      },
      'Call session created'
    );

    return session;
  }

  /**
   * Update call session
   */
  async updateCallSession(callSessionId: string, input: UpdateCallSessionInput) {
    const [updated] = await this.database
      .update(callSessions)
      .set({
        ...input,
        updatedAt: new Date(),
      })
      .where(eq(callSessions.id, callSessionId))
      .returning();

    logger.info({ callSessionId, updates: input }, 'Call session updated');

    return updated;
  }

  /**
   * Get call attempts for a lead
   */
  async getCallAttempts(leadId: string) {
    const attempts = await this.database.query.callAttempts.findMany({
      where: eq(callAttempts.leadId, leadId),
      orderBy: [desc(callAttempts.attemptNumber)],
    });

    return attempts;
  }

  /**
   * Get latest call attempt for lead
   */
  async getLatestCallAttempt(leadId: string) {
    const [attempt] = await this.database.query.callAttempts.findMany({
      where: eq(callAttempts.leadId, leadId),
      orderBy: [desc(callAttempts.attemptNumber)],
      limit: 1,
    });

    return attempt || null;
  }

  /**
   * Create call attempt
   */
  async createCallAttempt(
    dealerId: string,
    leadId: string,
    attemptNumber: number,
    scheduledFor?: Date
  ) {
    // Check if max attempts reached
    const profile = await this.dealerService.getCallingProfile(dealerId);
    if (attemptNumber > profile.maxAttemptsPerLead) {
      throw new MaxAttemptsError(leadId, profile.maxAttemptsPerLead);
    }

    const [attempt] = await this.database
      .insert(callAttempts)
      .values({
        dealerId,
        leadId,
        attemptNumber,
        status: scheduledFor ? 'scheduled' : 'pending',
        scheduledFor,
      })
      .returning();

    logger.info(
      {
        leadId,
        attemptNumber,
        scheduledFor,
      },
      'Call attempt created'
    );

    return attempt;
  }

  /**
   * Update call attempt
   */
  async updateCallAttempt(
    attemptId: string,
    update: {
      status?: string;
      callSessionId?: string;
      attemptedAt?: Date;
      failureReason?: string;
    }
  ) {
    const [updated] = await this.database
      .update(callAttempts)
      .set(update)
      .where(eq(callAttempts.id, attemptId))
      .returning();

    return updated;
  }

  /**
   * Schedule next retry for a lead
   */
  async scheduleRetry(dealerId: string, leadId: string) {
    const latestAttempt = await this.getLatestCallAttempt(leadId);
    const nextAttemptNumber = (latestAttempt?.attemptNumber || 0) + 1;

    // Get retry delay
    const delayMinutes = await this.dealerService.getRetryDelay(dealerId, nextAttemptNumber);

    // Calculate scheduled time
    const scheduledFor = new Date();
    scheduledFor.setMinutes(scheduledFor.getMinutes() + delayMinutes);

    return this.createCallAttempt(dealerId, leadId, nextAttemptNumber, scheduledFor);
  }

  /**
   * Save call transcript
   */
  async saveTranscript(callSessionId: string, fullTranscript: string, turns: unknown[]) {
    const [transcript] = await this.database
      .insert(transcripts)
      .values({
        callSessionId,
        fullTranscript,
        turns,
      })
      .returning();

    logger.info({ callSessionId, transcriptId: transcript.id }, 'Transcript saved');

    return transcript;
  }

  /**
   * Get transcript for call session
   */
  async getTranscript(callSessionId: string) {
    const transcript = await this.database.query.transcripts.findFirst({
      where: eq(transcripts.callSessionId, callSessionId),
    });

    return transcript || null;
  }

  /**
   * Save call summary
   */
  async saveSummary(
    callSessionId: string,
    summary: string,
    options?: {
      keyPoints?: string[];
      sentiment?: 'positive' | 'neutral' | 'negative';
      qualificationData?: Record<string, unknown>;
    }
  ) {
    const [callSummary] = await this.database
      .insert(callSummaries)
      .values({
        callSessionId,
        summary,
        keyPoints: options?.keyPoints || null,
        sentiment: options?.sentiment || null,
        qualificationData: options?.qualificationData || null,
      })
      .returning();

    logger.info({ callSessionId, summaryId: callSummary.id }, 'Call summary saved');

    return callSummary;
  }

  /**
   * Get summary for call session
   */
  async getSummary(callSessionId: string) {
    const summary = await this.database.query.callSummaries.findFirst({
      where: eq(callSummaries.callSessionId, callSessionId),
    });

    return summary || null;
  }

  /**
   * Get call statistics for dealer
   */
  async getCallStats(dealerId: string, options?: { since?: Date; until?: Date }) {
    // TODO: Implement aggregation queries
    // For now, return placeholder
    return {
      totalCalls: 0,
      answeredCalls: 0,
      transferredCalls: 0,
      averageDuration: 0,
    };
  }

  /**
   * Mark call as transferred
   */
  async markAsTransferred(callSessionId: string, userId: string, completed: boolean = true) {
    return this.updateCallSession(callSessionId, {
      transferredToUserId: userId,
      transferCompleted: completed,
      status: completed ? 'transferred' : 'in_progress',
      outcome: completed ? 'transferred' : undefined,
    });
  }
}
