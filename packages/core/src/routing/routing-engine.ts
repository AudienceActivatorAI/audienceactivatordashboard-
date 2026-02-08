import { eq, and, desc } from 'drizzle-orm';
import { db, routingRules, dealerUsers, type Database } from '@dealerbdc/database';
import { NoRoutingRuleError, NoAvailableRepError, logger } from '@dealerbdc/shared';

export interface RoutingContext {
  dealerId: string;
  storeId?: string;
  department?: string;
  vehicleOfInterest?: string;
  source?: string;
  intentScore?: number;
  leadValue?: number;
  metadata?: Record<string, unknown>;
}

export interface RoutingTarget {
  type: 'user' | 'team' | 'department' | 'voicemail';
  userId?: string;
  user?: {
    id: string;
    firstName: string;
    lastName: string;
    phone: string;
    email: string;
    role: string;
    department: string | null;
  };
  fallbackRuleId?: string;
}

/**
 * RoutingEngine
 *
 * CRITICAL: Implements deterministic routing logic
 * AI NEVER guesses who to transfer to - routing is 100% rules-based
 *
 * Flow:
 * 1. Evaluate routing rules in priority order
 * 2. Match conditions against context
 * 3. Find available rep for matched rule
 * 4. If no rep available, cascade to fallback rule
 * 5. Ultimate fallback: return NoAvailableRepError
 */
export class RoutingEngine {
  constructor(private readonly database: Database = db) {}

  /**
   * Evaluate routing rules and find target rep
   * This is the main entry point for routing decisions
   */
  async route(context: RoutingContext): Promise<RoutingTarget> {
    logger.debug({ context }, 'Starting routing evaluation');

    // Get active routing rules for dealer
    const rules = await this.getActiveRules(context.dealerId, context.storeId);

    if (rules.length === 0) {
      throw new NoRoutingRuleError(context.dealerId, context);
    }

    // Evaluate rules in priority order
    for (const rule of rules) {
      const matches = this.evaluateRuleConditions(rule.conditions as Record<string, unknown>, context);

      if (matches) {
        logger.info({ ruleId: rule.id, ruleName: rule.name }, 'Routing rule matched');

        // Try to find available rep for this rule
        const target = await this.resolveRuleTarget(rule);

        if (target) {
          return target;
        }

        // If no target available, try fallback rule
        if (rule.fallbackRuleId) {
          logger.info(
            { ruleId: rule.id, fallbackRuleId: rule.fallbackRuleId },
            'Primary rule has no available target, trying fallback'
          );

          const fallbackRule = await this.database.query.routingRules.findFirst({
            where: eq(routingRules.id, rule.fallbackRuleId),
          });

          if (fallbackRule) {
            const fallbackTarget = await this.resolveRuleTarget(fallbackRule);
            if (fallbackTarget) {
              return fallbackTarget;
            }
          }
        }

        // Continue to next rule if this one has no available targets
        logger.warn({ ruleId: rule.id }, 'No available target for matched rule, continuing');
      }
    }

    // No matching rule with available target found
    throw new NoAvailableRepError(context.dealerId);
  }

  /**
   * Get active routing rules for dealer/store
   * Sorted by priority (highest first)
   */
  private async getActiveRules(dealerId: string, storeId?: string) {
    const conditions = [eq(routingRules.dealerId, dealerId), eq(routingRules.active, true)];

    if (storeId) {
      // Get both dealer-level and store-level rules
      const dealerRules = await this.database.query.routingRules.findMany({
        where: and(...conditions),
        orderBy: [desc(routingRules.priority)],
      });

      const storeRules = await this.database.query.routingRules.findMany({
        where: and(...conditions, eq(routingRules.storeId, storeId)),
        orderBy: [desc(routingRules.priority)],
      });

      // Combine and sort by priority
      return [...storeRules, ...dealerRules].sort((a, b) => b.priority - a.priority);
    }

    return this.database.query.routingRules.findMany({
      where: and(...conditions),
      orderBy: [desc(routingRules.priority)],
    });
  }

  /**
   * Evaluate if a rule's conditions match the routing context
   * All conditions must match (AND logic)
   */
  private evaluateRuleConditions(
    conditions: Record<string, unknown>,
    context: RoutingContext
  ): boolean {
    // Empty conditions match everything
    if (Object.keys(conditions).length === 0) {
      return true;
    }

    // Check each condition
    for (const [key, value] of Object.entries(conditions)) {
      if (!this.evaluateCondition(key, value, context)) {
        return false;
      }
    }

    return true;
  }

  /**
   * Evaluate a single condition
   */
  private evaluateCondition(
    key: string,
    conditionValue: unknown,
    context: RoutingContext
  ): boolean {
    const contextValue = context[key as keyof RoutingContext];

    // Handle different condition types
    if (typeof conditionValue === 'object' && conditionValue !== null) {
      // Range condition: {min: 70, max: 100}
      if ('min' in conditionValue || 'max' in conditionValue) {
        const numValue = Number(contextValue);
        const min = 'min' in conditionValue ? Number(conditionValue.min) : -Infinity;
        const max = 'max' in conditionValue ? Number(conditionValue.max) : Infinity;
        return numValue >= min && numValue <= max;
      }

      // Array contains: {in: ['new', 'used']}
      if ('in' in conditionValue && Array.isArray(conditionValue.in)) {
        return conditionValue.in.includes(contextValue);
      }

      // Exists check: {exists: true}
      if ('exists' in conditionValue) {
        const exists = contextValue !== undefined && contextValue !== null;
        return conditionValue.exists ? exists : !exists;
      }
    }

    // Simple equality
    return contextValue === conditionValue;
  }

  /**
   * Resolve a routing rule to an actual target
   */
  private async resolveRuleTarget(
    rule: typeof routingRules.$inferSelect
  ): Promise<RoutingTarget | null> {
    switch (rule.routeToType) {
      case 'user':
        if (!rule.routeToId) {
          logger.error({ ruleId: rule.id }, 'User routing rule missing routeToId');
          return null;
        }
        return this.findAvailableUser(rule.routeToId);

      case 'department':
        // Route to any available user in department
        return this.findAvailableUserByDepartment(
          rule.dealerId,
          (rule.conditions as Record<string, unknown>).department as string
        );

      case 'team':
        // TODO: Implement team routing (requires teams table)
        logger.warn({ ruleId: rule.id }, 'Team routing not yet implemented');
        return null;

      case 'voicemail':
        // Return voicemail target (no user)
        return {
          type: 'voicemail',
        };

      default:
        logger.error({ ruleId: rule.id, routeToType: rule.routeToType }, 'Unknown routing type');
        return null;
    }
  }

  /**
   * Find available user by ID
   */
  private async findAvailableUser(userId: string): Promise<RoutingTarget | null> {
    const user = await this.database.query.dealerUsers.findFirst({
      where: and(
        eq(dealerUsers.id, userId),
        eq(dealerUsers.status, 'active'),
        eq(dealerUsers.acceptsTransfers, true)
      ),
    });

    if (!user) {
      logger.debug({ userId }, 'User not available for transfer');
      return null;
    }

    return {
      type: 'user',
      userId: user.id,
      user: {
        id: user.id,
        firstName: user.firstName,
        lastName: user.lastName,
        phone: user.phone || '',
        email: user.email,
        role: user.role,
        department: user.department,
      },
    };
  }

  /**
   * Find available user by department
   * Returns highest priority user in department
   */
  private async findAvailableUserByDepartment(
    dealerId: string,
    department: string
  ): Promise<RoutingTarget | null> {
    const users = await this.database.query.dealerUsers.findMany({
      where: and(
        eq(dealerUsers.dealerId, dealerId),
        eq(dealerUsers.department, department),
        eq(dealerUsers.status, 'active'),
        eq(dealerUsers.acceptsTransfers, true)
      ),
      orderBy: [desc(dealerUsers.transferPriority)],
    });

    if (users.length === 0) {
      logger.debug({ dealerId, department }, 'No available users in department');
      return null;
    }

    // Return highest priority user
    const user = users[0];

    return {
      type: 'user',
      userId: user.id,
      user: {
        id: user.id,
        firstName: user.firstName,
        lastName: user.lastName,
        phone: user.phone || '',
        email: user.email,
        role: user.role,
        department: user.department,
      },
    };
  }

  /**
   * Get fallback chain for a routing rule
   * Returns array of rules to try in order
   */
  async getFallbackChain(ruleId: string): Promise<Array<typeof routingRules.$inferSelect>> {
    const chain: Array<typeof routingRules.$inferSelect> = [];
    let currentRuleId: string | null = ruleId;

    // Follow fallback chain (max depth 10 to prevent infinite loops)
    for (let i = 0; i < 10 && currentRuleId; i++) {
      const rule = await this.database.query.routingRules.findFirst({
        where: eq(routingRules.id, currentRuleId),
      });

      if (!rule) break;

      chain.push(rule);
      currentRuleId = rule.fallbackRuleId;
    }

    return chain;
  }

  /**
   * Test routing for a given context (useful for debugging)
   * Returns the matched rule and target without making any changes
   */
  async testRoute(context: RoutingContext): Promise<{
    matchedRule: typeof routingRules.$inferSelect | null;
    target: RoutingTarget | null;
    allRulesEvaluated: Array<{
      rule: typeof routingRules.$inferSelect;
      matched: boolean;
      hasAvailableTarget: boolean;
    }>;
  }> {
    const rules = await this.getActiveRules(context.dealerId, context.storeId);
    const evaluations = [];
    let matchedRule = null;
    let target = null;

    for (const rule of rules) {
      const matches = this.evaluateRuleConditions(rule.conditions as Record<string, unknown>, context);
      const ruleTarget = matches ? await this.resolveRuleTarget(rule) : null;

      evaluations.push({
        rule,
        matched: matches,
        hasAvailableTarget: ruleTarget !== null,
      });

      if (matches && ruleTarget && !target) {
        matchedRule = rule;
        target = ruleTarget;
      }
    }

    return {
      matchedRule,
      target,
      allRulesEvaluated: evaluations,
    };
  }
}
