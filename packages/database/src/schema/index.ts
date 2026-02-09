import { pgTable, uuid, text, timestamp, jsonb, boolean, integer, time, index, uniqueIndex, inet, date } from 'drizzle-orm/pg-core';
import { relations, sql } from 'drizzle-orm';

// ============================================================
// DEALERS AND STORES
// ============================================================

export const dealers = pgTable('dealers', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull(),
  legalName: text('legal_name'),
  status: text('status').notNull().default('active'), // 'active' | 'suspended' | 'trial' | 'churned'
  timezone: text('timezone').notNull().default('America/New_York'),
  planTier: text('plan_tier').notNull().default('trial'), // 'trial' | 'starter' | 'growth' | 'enterprise'
  trialEndsAt: timestamp('trial_ends_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  metadata: jsonb('metadata').default('{}'),
}, (table) => ({
  statusIdx: index('idx_dealers_status').on(table.id).where(sql`status = 'active'`),
}));

export const stores = pgTable('stores', {
  id: uuid('id').primaryKey().defaultRandom(),
  dealerId: uuid('dealer_id').notNull().references(() => dealers.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  addressStreet: text('address_street'),
  addressCity: text('address_city'),
  addressState: text('address_state'),
  addressZip: text('address_zip'),
  status: text('status').notNull().default('active'), // 'active' | 'inactive'
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  metadata: jsonb('metadata').default('{}'),
}, (table) => ({
  dealerIdx: index('idx_stores_dealer').on(table.dealerId),
  dealerActiveIdx: index('idx_stores_dealer_active').on(table.dealerId, table.status).where(sql`status = 'active'`),
}));

export const dealerUsers = pgTable('dealer_users', {
  id: uuid('id').primaryKey().defaultRandom(),
  dealerId: uuid('dealer_id').notNull().references(() => dealers.id, { onDelete: 'cascade' }),
  storeId: uuid('store_id').references(() => stores.id, { onDelete: 'set null' }),
  email: text('email').notNull(),
  phone: text('phone'),
  firstName: text('first_name').notNull(),
  lastName: text('last_name').notNull(),
  role: text('role').notNull(), // 'bdc_agent' | 'sales_rep' | 'manager' | 'admin'
  department: text('department'), // 'new' | 'used' | 'service' | 'parts' | 'finance'
  acceptsTransfers: boolean('accepts_transfers').notNull().default(true),
  transferPriority: integer('transfer_priority').default(0),
  status: text('status').notNull().default('active'), // 'active' | 'inactive' | 'dnd'
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  metadata: jsonb('metadata').default('{}'),
}, (table) => ({
  uniqueDealerEmail: uniqueIndex('unique_dealer_user_email').on(table.dealerId, table.email),
  dealerIdx: index('idx_dealer_users_dealer').on(table.dealerId),
  storeIdx: index('idx_dealer_users_store').on(table.storeId),
  transferIdx: index('idx_dealer_users_transfer').on(table.dealerId, table.acceptsTransfers, table.status).where(
    sql`accepts_transfers = true AND status = 'active'`
  ),
}));

export const dealerNumbers = pgTable('dealer_numbers', {
  id: uuid('id').primaryKey().defaultRandom(),
  dealerId: uuid('dealer_id').notNull().references(() => dealers.id, { onDelete: 'cascade' }),
  storeId: uuid('store_id').references(() => stores.id, { onDelete: 'set null' }),
  phoneNumber: text('phone_number').notNull().unique(),
  signalwireSid: text('signalwire_sid').notNull().unique(),
  numberType: text('number_type').notNull(), // 'local' | 'toll_free'
  purpose: text('purpose').notNull().default('outbound'), // 'outbound' | 'inbound' | 'both'
  status: text('status').notNull().default('active'), // 'active' | 'inactive'
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  metadata: jsonb('metadata').default('{}'),
}, (table) => ({
  dealerIdx: index('idx_dealer_numbers_dealer').on(table.dealerId),
  activeIdx: index('idx_dealer_numbers_active').on(table.dealerId, table.status).where(sql`status = 'active'`),
}));

export const dealerCallingProfiles = pgTable('dealer_calling_profiles', {
  id: uuid('id').primaryKey().defaultRandom(),
  dealerId: uuid('dealer_id').notNull().references(() => dealers.id, { onDelete: 'cascade' }),
  callingHoursStart: time('calling_hours_start').notNull().default('08:00:00'),
  callingHoursEnd: time('calling_hours_end').notNull().default('20:00:00'),
  callingDaysOfWeek: integer('calling_days_of_week').array().notNull().default([1, 2, 3, 4, 5, 6]),
  maxConcurrentCalls: integer('max_concurrent_calls').notNull().default(3),
  maxCallsPerHour: integer('max_calls_per_hour').notNull().default(50),
  maxAttemptsPerLead: integer('max_attempts_per_lead').notNull().default(3),
  retryDelayMinutes: integer('retry_delay_minutes').array().notNull().default([30, 120, 1440]),
  honorDnc: boolean('honor_dnc').notNull().default(true),
  requireConsent: boolean('require_consent').notNull().default(true),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  uniqueDealerIdx: uniqueIndex('idx_dealer_calling_profiles_dealer').on(table.dealerId),
}));

export const routingRules = pgTable('routing_rules', {
  id: uuid('id').primaryKey().defaultRandom(),
  dealerId: uuid('dealer_id').notNull().references(() => dealers.id, { onDelete: 'cascade' }),
  storeId: uuid('store_id').references(() => stores.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  priority: integer('priority').notNull().default(0),
  conditions: jsonb('conditions').notNull(),
  routeToType: text('route_to_type').notNull(), // 'user' | 'team' | 'department' | 'voicemail'
  routeToId: uuid('route_to_id'),
  fallbackRuleId: uuid('fallback_rule_id'),
  active: boolean('active').notNull().default(true),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  dealerIdx: index('idx_routing_rules_dealer').on(table.dealerId, table.priority).where(sql`active = true`),
  storeIdx: index('idx_routing_rules_store').on(table.storeId, table.priority).where(sql`active = true`),
}));

// ============================================================
// LEADS
// ============================================================

export const leads = pgTable('leads', {
  id: uuid('id').primaryKey().defaultRandom(),
  dealerId: uuid('dealer_id').notNull().references(() => dealers.id, { onDelete: 'cascade' }),
  storeId: uuid('store_id').references(() => stores.id, { onDelete: 'set null' }),
  phone: text('phone'),
  email: text('email'),
  firstName: text('first_name'),
  lastName: text('last_name'),
  department: text('department'), // 'new' | 'used' | 'service' | 'parts' | 'finance'
  vehicleOfInterest: text('vehicle_of_interest'),
  source: text('source'),
  sourceDetail: text('source_detail'),
  status: text('status').notNull().default('new'), // 'new' | 'contacted' | 'qualified' | 'appointment_set' | 'transferred' | 'sold' | 'lost' | 'nurture'
  ownedBy: text('owned_by').notNull().default('ai'), // 'ai' | 'human'
  assignedToUserId: uuid('assigned_to_user_id').references(() => dealerUsers.id, { onDelete: 'set null' }),
  transferredAt: timestamp('transferred_at', { withTimezone: true }),
  firstSeenAt: timestamp('first_seen_at', { withTimezone: true }).notNull().defaultNow(),
  lastContactedAt: timestamp('last_contacted_at', { withTimezone: true }),
  lastActivityAt: timestamp('last_activity_at', { withTimezone: true }).notNull().defaultNow(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  metadata: jsonb('metadata').default('{}'),
}, (table) => ({
  dealerIdx: index('idx_leads_dealer').on(table.dealerId),
  dealerStatusIdx: index('idx_leads_dealer_status').on(table.dealerId, table.status),
  phoneIdx: index('idx_leads_phone').on(table.phone).where(sql`phone IS NOT NULL`),
  emailIdx: index('idx_leads_email').on(table.email).where(sql`email IS NOT NULL`),
  ownedByIdx: index('idx_leads_owned_by').on(table.dealerId, table.ownedBy, table.status),
}));

export const leadIdentities = pgTable('lead_identities', {
  id: uuid('id').primaryKey().defaultRandom(),
  leadId: uuid('lead_id').notNull().references(() => leads.id, { onDelete: 'cascade' }),
  identityType: text('identity_type').notNull(), // 'phone' | 'email' | 'cookie' | 'ip' | 'device_id'
  identityValue: text('identity_value').notNull(),
  confidence: integer('confidence').default(100), // 0-100
  firstSeenAt: timestamp('first_seen_at', { withTimezone: true }).notNull().defaultNow(),
  lastSeenAt: timestamp('last_seen_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  uniqueLeadIdentity: uniqueIndex('unique_lead_identity').on(table.leadId, table.identityType, table.identityValue),
  leadIdx: index('idx_lead_identities_lead').on(table.leadId),
  lookupIdx: index('idx_lead_identities_lookup').on(table.identityType, table.identityValue),
}));

export const leadIntentScores = pgTable('lead_intent_scores', {
  id: uuid('id').primaryKey().defaultRandom(),
  leadId: uuid('lead_id').notNull().references(() => leads.id, { onDelete: 'cascade' }),
  score: integer('score').notNull(), // 0-100
  factors: jsonb('factors').notNull(),
  scoredAt: timestamp('scored_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  leadIdx: index('idx_intent_scores_lead').on(table.leadId, table.scoredAt),
  highScoreIdx: index('idx_intent_scores_high').on(table.leadId, table.score).where(sql`score >= 70`),
}));

// ============================================================
// CALLS
// ============================================================

export const callSessions = pgTable('call_sessions', {
  id: uuid('id').primaryKey().defaultRandom(),
  dealerId: uuid('dealer_id').notNull().references(() => dealers.id, { onDelete: 'cascade' }),
  leadId: uuid('lead_id').notNull().references(() => leads.id, { onDelete: 'cascade' }),
  signalwireCallSid: text('signalwire_call_sid').unique(),
  fromNumber: text('from_number').notNull(),
  toNumber: text('to_number').notNull(),
  swaigSessionId: text('swaig_session_id').unique(),
  swaigAgentId: text('swaig_agent_id'),
  status: text('status').notNull().default('initiated'), // 'initiated' | 'ringing' | 'answered' | 'in_progress' | 'transferred' | 'completed' | 'failed' | 'no_answer' | 'busy' | 'voicemail'
  outcome: text('outcome'), // 'qualified' | 'not_interested' | 'callback_requested' | 'transferred' | 'appointment_set' | 'voicemail_left' | 'no_answer' | 'wrong_number'
  initiatedAt: timestamp('initiated_at', { withTimezone: true }).notNull().defaultNow(),
  answeredAt: timestamp('answered_at', { withTimezone: true }),
  endedAt: timestamp('ended_at', { withTimezone: true }),
  durationSeconds: integer('duration_seconds'),
  transferredToUserId: uuid('transferred_to_user_id').references(() => dealerUsers.id),
  transferCompleted: boolean('transfer_completed').default(false),
  recordingUrl: text('recording_url'),
  recordingDuration: integer('recording_duration'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  metadata: jsonb('metadata').default('{}'),
}, (table) => ({
  dealerIdx: index('idx_call_sessions_dealer').on(table.dealerId),
  leadIdx: index('idx_call_sessions_lead').on(table.leadId, table.initiatedAt),
  signalwireIdx: index('idx_call_sessions_signalwire').on(table.signalwireCallSid).where(sql`signalwire_call_sid IS NOT NULL`),
  swaigIdx: index('idx_call_sessions_swaig').on(table.swaigSessionId).where(sql`swaig_session_id IS NOT NULL`),
}));

export const callAttempts = pgTable('call_attempts', {
  id: uuid('id').primaryKey().defaultRandom(),
  dealerId: uuid('dealer_id').notNull().references(() => dealers.id, { onDelete: 'cascade' }),
  leadId: uuid('lead_id').notNull().references(() => leads.id, { onDelete: 'cascade' }),
  callSessionId: uuid('call_session_id').references(() => callSessions.id, { onDelete: 'set null' }),
  attemptNumber: integer('attempt_number').notNull(),
  status: text('status').notNull(), // 'pending' | 'calling' | 'completed' | 'failed' | 'scheduled'
  scheduledFor: timestamp('scheduled_for', { withTimezone: true }),
  attemptedAt: timestamp('attempted_at', { withTimezone: true }),
  failureReason: text('failure_reason'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  uniqueLeadAttempt: uniqueIndex('unique_lead_attempt').on(table.leadId, table.attemptNumber),
  leadIdx: index('idx_call_attempts_lead').on(table.leadId, table.attemptNumber),
  scheduledIdx: index('idx_call_attempts_scheduled').on(table.dealerId, table.scheduledFor).where(
    sql`status = 'scheduled' AND scheduled_for IS NOT NULL`
  ),
}));

export const transcripts = pgTable('transcripts', {
  id: uuid('id').primaryKey().defaultRandom(),
  callSessionId: uuid('call_session_id').notNull().references(() => callSessions.id, { onDelete: 'cascade' }),
  fullTranscript: text('full_transcript').notNull(),
  turns: jsonb('turns').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  callIdx: index('idx_transcripts_call').on(table.callSessionId),
}));

export const callSummaries = pgTable('call_summaries', {
  id: uuid('id').primaryKey().defaultRandom(),
  callSessionId: uuid('call_session_id').notNull().references(() => callSessions.id, { onDelete: 'cascade' }),
  summary: text('summary').notNull(),
  keyPoints: jsonb('key_points'),
  sentiment: text('sentiment'), // 'positive' | 'neutral' | 'negative'
  qualificationData: jsonb('qualification_data'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  callIdx: index('idx_call_summaries_call').on(table.callSessionId),
}));

// ============================================================
// EVENTS AND NOTIFICATIONS
// ============================================================

export const pixelEvents = pgTable('pixel_events', {
  id: uuid('id').primaryKey().defaultRandom(),
  dealerId: uuid('dealer_id').notNull().references(() => dealers.id, { onDelete: 'cascade' }),
  leadId: uuid('lead_id').references(() => leads.id, { onDelete: 'set null' }),
  eventType: text('event_type').notNull(),
  eventData: jsonb('event_data').notNull(),
  phone: text('phone'),
  email: text('email'),
  cookieId: text('cookie_id'),
  ipAddress: inet('ip_address'),
  userAgent: text('user_agent'),
  pageUrl: text('page_url'),
  referrer: text('referrer'),
  receivedAt: timestamp('received_at', { withTimezone: true }).notNull().defaultNow(),
  processedAt: timestamp('processed_at', { withTimezone: true }),
  metadata: jsonb('metadata').default('{}'),
}, (table) => ({
  dealerIdx: index('idx_pixel_events_dealer').on(table.dealerId, table.receivedAt),
  leadIdx: index('idx_pixel_events_lead').on(table.leadId, table.receivedAt).where(sql`lead_id IS NOT NULL`),
  unprocessedIdx: index('idx_pixel_events_unprocessed').on(table.dealerId, table.receivedAt).where(sql`processed_at IS NULL`),
}));

export const notifications = pgTable('notifications', {
  id: uuid('id').primaryKey().defaultRandom(),
  dealerId: uuid('dealer_id').notNull().references(() => dealers.id, { onDelete: 'cascade' }),
  userId: uuid('user_id').references(() => dealerUsers.id, { onDelete: 'cascade' }),
  notificationType: text('notification_type').notNull(), // 'transfer_ready' | 'missed_transfer' | 'appointment_set' | 'high_intent_lead' | 'call_failed'
  title: text('title').notNull(),
  message: text('message').notNull(),
  relatedLeadId: uuid('related_lead_id').references(() => leads.id),
  relatedCallId: uuid('related_call_id').references(() => callSessions.id),
  status: text('status').notNull().default('unread'), // 'unread' | 'read' | 'archived'
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  userIdx: index('idx_notifications_user').on(table.userId, table.status, table.createdAt),
  dealerIdx: index('idx_notifications_dealer').on(table.dealerId, table.createdAt),
}));

export const messageLogs = pgTable('message_logs', {
  id: uuid('id').primaryKey().defaultRandom(),
  dealerId: uuid('dealer_id').notNull().references(() => dealers.id, { onDelete: 'cascade' }),
  leadId: uuid('lead_id').notNull().references(() => leads.id, { onDelete: 'cascade' }),
  messageType: text('message_type').notNull(), // 'sms' | 'email' | 'call'
  direction: text('direction').notNull(), // 'inbound' | 'outbound'
  fromAddress: text('from_address').notNull(),
  toAddress: text('to_address').notNull(),
  subject: text('subject'),
  body: text('body').notNull(),
  provider: text('provider'),
  providerMessageId: text('provider_message_id'),
  status: text('status').notNull().default('sent'), // 'sent' | 'delivered' | 'failed' | 'bounced'
  sentAt: timestamp('sent_at', { withTimezone: true }).notNull().defaultNow(),
  deliveredAt: timestamp('delivered_at', { withTimezone: true }),
  metadata: jsonb('metadata').default('{}'),
}, (table) => ({
  leadIdx: index('idx_message_logs_lead').on(table.leadId, table.sentAt),
  dealerIdx: index('idx_message_logs_dealer').on(table.dealerId, table.sentAt),
}));

export const optOuts = pgTable('opt_outs', {
  id: uuid('id').primaryKey().defaultRandom(),
  dealerId: uuid('dealer_id').notNull().references(() => dealers.id, { onDelete: 'cascade' }),
  phone: text('phone'),
  email: text('email'),
  optOutType: text('opt_out_type').notNull(), // 'sms' | 'call' | 'email' | 'all'
  optedOutAt: timestamp('opted_out_at', { withTimezone: true }).notNull().defaultNow(),
  reason: text('reason'),
}, (table) => ({
  phoneIdx: index('idx_opt_outs_phone').on(table.dealerId, table.phone).where(sql`phone IS NOT NULL`),
  emailIdx: index('idx_opt_outs_email').on(table.dealerId, table.email).where(sql`email IS NOT NULL`),
}));

// ============================================================
// VEHICLE INTERESTS AND ENRICHMENT
// ============================================================

export const vehicleInterests = pgTable('vehicle_interests', {
  id: uuid('id').primaryKey().defaultRandom(),
  leadId: uuid('lead_id').notNull().references(() => leads.id, { onDelete: 'cascade' }),
  dealerId: uuid('dealer_id').notNull().references(() => dealers.id, { onDelete: 'cascade' }),
  vehicleYear: integer('vehicle_year'),
  vehicleMake: text('vehicle_make'),
  vehicleModel: text('vehicle_model'),
  vehicleVin: text('vehicle_vin'),
  vehicleStockNumber: text('vehicle_stock_number'),
  vehicleUrl: text('vehicle_url'),
  eventType: text('event_type'),
  eventTimestamp: timestamp('event_timestamp', { withTimezone: true }),
  timeOnPage: integer('time_on_page'),
  interactionCount: integer('interaction_count').default(1),
  isPrimary: boolean('is_primary').default(false),
  firstViewedAt: timestamp('first_viewed_at', { withTimezone: true }).notNull().defaultNow(),
  lastViewedAt: timestamp('last_viewed_at', { withTimezone: true }).notNull().defaultNow(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  metadata: jsonb('metadata').default('{}'),
}, (table) => ({
  leadIdx: index('idx_vehicle_interests_lead').on(table.leadId, table.lastViewedAt),
  dealerIdx: index('idx_vehicle_interests_dealer').on(table.dealerId, table.createdAt),
  primaryIdx: index('idx_vehicle_interests_primary').on(table.leadId, table.isPrimary).where(sql`is_primary = true`),
  vinIdx: index('idx_vehicle_interests_vin').on(table.vehicleVin).where(sql`vehicle_vin IS NOT NULL`),
}));

export const leadEnrichments = pgTable('lead_enrichments', {
  id: uuid('id').primaryKey().defaultRandom(),
  leadId: uuid('lead_id').notNull().references(() => leads.id, { onDelete: 'cascade' }),
  dealerId: uuid('dealer_id').notNull().references(() => dealers.id, { onDelete: 'cascade' }),
  hemSha256: text('hem_sha256'),
  skiptraceCreditRating: text('skiptrace_credit_rating'),
  creditScoreMin: integer('credit_score_min'),
  creditScoreMax: integer('credit_score_max'),
  personalCity: text('personal_city'),
  personalState: text('personal_state'),
  personalZip: text('personal_zip'),
  mobilePhone: text('mobile_phone'),
  personalEmail: text('personal_email'),
  activityStartDate: timestamp('activity_start_date', { withTimezone: true }),
  activityEndDate: timestamp('activity_end_date', { withTimezone: true }),
  enrichmentSource: text('enrichment_source').default('csv_import'),
  enrichmentProvider: text('enrichment_provider'),
  confidenceScore: integer('confidence_score').default(100), // 0-100
  enrichedAt: timestamp('enriched_at', { withTimezone: true }).notNull().defaultNow(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  metadata: jsonb('metadata').default('{}'),
}, (table) => ({
  uniqueLeadEnrichment: uniqueIndex('unique_lead_enrichment').on(table.leadId),
  leadIdx: index('idx_lead_enrichments_lead').on(table.leadId),
  hemIdx: index('idx_lead_enrichments_hem').on(table.hemSha256).where(sql`hem_sha256 IS NOT NULL`),
  creditIdx: index('idx_lead_enrichments_credit').on(table.dealerId, table.creditScoreMin).where(sql`credit_score_min IS NOT NULL`),
}));

export const csvImports = pgTable('csv_imports', {
  id: uuid('id').primaryKey().defaultRandom(),
  dealerId: uuid('dealer_id').notNull().references(() => dealers.id, { onDelete: 'cascade' }),
  importSource: text('import_source').notNull(),
  fileName: text('file_name'),
  fileHash: text('file_hash'),
  totalRows: integer('total_rows').notNull().default(0),
  processedRows: integer('processed_rows').notNull().default(0),
  failedRows: integer('failed_rows').notNull().default(0),
  skippedRows: integer('skipped_rows').notNull().default(0),
  status: text('status').notNull().default('processing'), // 'processing' | 'completed' | 'failed' | 'partially_completed'
  errorLog: jsonb('error_log').default('[]'),
  startedAt: timestamp('started_at', { withTimezone: true }).notNull().defaultNow(),
  completedAt: timestamp('completed_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  metadata: jsonb('metadata').default('{}'),
}, (table) => ({
  dealerIdx: index('idx_csv_imports_dealer').on(table.dealerId, table.createdAt),
  statusIdx: index('idx_csv_imports_status').on(table.dealerId, table.status).where(sql`status = 'processing'`),
  hashIdx: index('idx_csv_imports_hash').on(table.fileHash).where(sql`file_hash IS NOT NULL`),
}));

// ============================================================
// RELATIONS (for Drizzle ORM query builder)
// ============================================================

export const dealersRelations = relations(dealers, ({ many }) => ({
  stores: many(stores),
  users: many(dealerUsers),
  numbers: many(dealerNumbers),
  callingProfile: many(dealerCallingProfiles),
  routingRules: many(routingRules),
  leads: many(leads),
}));

export const storesRelations = relations(stores, ({ one, many }) => ({
  dealer: one(dealers, {
    fields: [stores.dealerId],
    references: [dealers.id],
  }),
  users: many(dealerUsers),
  numbers: many(dealerNumbers),
  routingRules: many(routingRules),
  leads: many(leads),
}));

export const leadsRelations = relations(leads, ({ one, many }) => ({
  dealer: one(dealers, {
    fields: [leads.dealerId],
    references: [dealers.id],
  }),
  store: one(stores, {
    fields: [leads.storeId],
    references: [stores.id],
  }),
  assignedToUser: one(dealerUsers, {
    fields: [leads.assignedToUserId],
    references: [dealerUsers.id],
  }),
  identities: many(leadIdentities),
  intentScores: many(leadIntentScores),
  callSessions: many(callSessions),
  callAttempts: many(callAttempts),
  pixelEvents: many(pixelEvents),
  messageLogs: many(messageLogs),
  vehicleInterests: many(vehicleInterests),
  enrichment: many(leadEnrichments),
}));

// ============================================================
// DEMO: IN-MARKET + HIGH-INTENT VEHICLE SHOPPERS
// ============================================================

export const rawImport = pgTable('raw_import', {
  id: uuid('id').primaryKey().defaultRandom(),
  customerId: uuid('customer_id').notNull(),
  firstName: text('first_name').notNull(),
  lastName: text('last_name').notNull(),
  personalVerifiedEmails: text('personal_verified_emails'),
  businessVerifiedEmails: text('business_verified_emails'),
  emailPrimary: text('email_primary'),
  mobilePhone: text('mobile_phone'),
  personalCity: text('personal_city').notNull(),
  personalState: text('personal_state').notNull(),
  personalZip: text('personal_zip').notNull(),
  skiptraceCreditRating: text('skiptrace_credit_rating').notNull(),
  skiptraceMatchScore: integer('skiptrace_match_score').notNull(),
  skiptraceIp: text('skiptrace_ip'),
  vehicleMake: text('vehicle_make').notNull(),
  vehicleModel: text('vehicle_model').notNull(),
  modelYear: integer('model_year').notNull(),
  assignmentMethod: text('assignment_method'),
  sourceFile: text('source_file'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull(),
}, (table) => ({
  customerIdx: index('idx_raw_import_customer').on(table.customerId),
  geoIdx: index('idx_raw_import_geo').on(table.personalState, table.personalCity, table.personalZip),
  vehicleIdx: index('idx_raw_import_vehicle').on(table.vehicleMake, table.vehicleModel, table.modelYear),
  createdIdx: index('idx_raw_import_created').on(table.createdAt),
}));

export const dimGeo = pgTable('dim_geo', {
  id: uuid('id').primaryKey().defaultRandom(),
  state: text('state').notNull(),
  city: text('city').notNull(),
  zip: text('zip').notNull(),
}, (table) => ({
  uniqueGeo: uniqueIndex('uniq_dim_geo').on(table.state, table.city, table.zip),
  stateIdx: index('idx_dim_geo_state').on(table.state),
  cityIdx: index('idx_dim_geo_city').on(table.state, table.city),
  zipIdx: index('idx_dim_geo_zip').on(table.zip),
}));

export const dimVehicle = pgTable('dim_vehicle', {
  id: uuid('id').primaryKey().defaultRandom(),
  make: text('make').notNull(),
  model: text('model').notNull(),
  modelYear: integer('model_year').notNull(),
}, (table) => ({
  uniqueVehicle: uniqueIndex('uniq_dim_vehicle').on(table.make, table.model, table.modelYear),
  makeIdx: index('idx_dim_vehicle_make').on(table.make),
  modelIdx: index('idx_dim_vehicle_model').on(table.make, table.model),
  yearIdx: index('idx_dim_vehicle_year').on(table.modelYear),
}));

export const factShopper = pgTable('fact_shopper', {
  id: uuid('id').primaryKey().defaultRandom(),
  customerId: uuid('customer_id').notNull(),
  geoId: uuid('geo_id').notNull().references(() => dimGeo.id, { onDelete: 'restrict' }),
  vehicleId: uuid('vehicle_id').notNull().references(() => dimVehicle.id, { onDelete: 'restrict' }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull(),
  creditRating: text('credit_rating').notNull(),
  matchScore: integer('match_score').notNull(),
  intentScore: integer('intent_score').notNull(),
  intentTier: text('intent_tier').notNull(), // 'Warm' | 'Hot' | 'SuperHot'
  demoMultiplierBucket: integer('demo_multiplier_bucket').notNull(),
  demoWeight: integer('demo_weight').notNull(),
  maskedEmail: text('masked_email'),
  maskedPhone: text('masked_phone'),
  sampleTag: text('sample_tag'), // 'demo' when safe to show in UI
}, (table) => ({
  customerIdx: index('idx_fact_shopper_customer').on(table.customerId),
  geoIdx: index('idx_fact_shopper_geo').on(table.geoId),
  vehicleIdx: index('idx_fact_shopper_vehicle').on(table.vehicleId),
  intentIdx: index('idx_fact_shopper_intent').on(table.intentTier, table.intentScore),
  createdIdx: index('idx_fact_shopper_created').on(table.createdAt),
  creditIdx: index('idx_fact_shopper_credit').on(table.creditRating),
}));

export const dailyStateAgg = pgTable('daily_state_agg', {
  date: date('date').notNull(),
  state: text('state').notNull(),
  identifiedShoppers: integer('identified_shoppers').notNull(),
  highIntentShoppers: integer('high_intent_shoppers').notNull(),
  avgIntentScore: integer('avg_intent_score').notNull(),
  opportunityIndex: integer('opportunity_index').notNull(),
  warmShoppers: integer('warm_shoppers').notNull(),
  hotShoppers: integer('hot_shoppers').notNull(),
  superHotShoppers: integer('superhot_shoppers').notNull(),
}, (table) => ({
  stateDateIdx: index('idx_daily_state_date').on(table.date, table.state),
}));

export const dailyCityAgg = pgTable('daily_city_agg', {
  date: date('date').notNull(),
  state: text('state').notNull(),
  city: text('city').notNull(),
  identifiedShoppers: integer('identified_shoppers').notNull(),
  highIntentShoppers: integer('high_intent_shoppers').notNull(),
  avgIntentScore: integer('avg_intent_score').notNull(),
  opportunityIndex: integer('opportunity_index').notNull(),
  warmShoppers: integer('warm_shoppers').notNull(),
  hotShoppers: integer('hot_shoppers').notNull(),
  superHotShoppers: integer('superhot_shoppers').notNull(),
}, (table) => ({
  cityDateIdx: index('idx_daily_city_date').on(table.date, table.state, table.city),
}));

export const dailyZipAgg = pgTable('daily_zip_agg', {
  date: date('date').notNull(),
  state: text('state').notNull(),
  city: text('city').notNull(),
  zip: text('zip').notNull(),
  identifiedShoppers: integer('identified_shoppers').notNull(),
  highIntentShoppers: integer('high_intent_shoppers').notNull(),
  avgIntentScore: integer('avg_intent_score').notNull(),
  opportunityIndex: integer('opportunity_index').notNull(),
  warmShoppers: integer('warm_shoppers').notNull(),
  hotShoppers: integer('hot_shoppers').notNull(),
  superHotShoppers: integer('superhot_shoppers').notNull(),
}, (table) => ({
  zipDateIdx: index('idx_daily_zip_date').on(table.date, table.state, table.city, table.zip),
}));
