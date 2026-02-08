import { eq, and } from 'drizzle-orm';
import { db, dealers, dealerCallingProfiles, dealerNumbers, type Database } from '@dealerbdc/database';
import {
  DealerNotFoundError,
  DealerInactiveError,
  CallingWindowError,
  RateLimitError,
  logger,
} from '@dealerbdc/shared';
import { format, toZonedTime } from 'date-fns-tz';
import { getDay, getHours, getMinutes } from 'date-fns';

export class DealerService {
  constructor(private readonly database: Database = db) {}

  /**
   * Get dealer by ID
   */
  async getDealer(dealerId: string) {
    const dealer = await this.database.query.dealers.findFirst({
      where: eq(dealers.id, dealerId),
    });

    if (!dealer) {
      throw new DealerNotFoundError(dealerId);
    }

    return dealer;
  }

  /**
   * Get active dealer (throws if inactive)
   */
  async getActiveDealer(dealerId: string) {
    const dealer = await this.getDealer(dealerId);

    if (dealer.status !== 'active') {
      throw new DealerInactiveError(dealerId);
    }

    return dealer;
  }

  /**
   * Get dealer calling profile
   */
  async getCallingProfile(dealerId: string) {
    const profile = await this.database.query.dealerCallingProfiles.findFirst({
      where: eq(dealerCallingProfiles.dealerId, dealerId),
    });

    if (!profile) {
      logger.warn({ dealerId }, 'No calling profile found for dealer');
      // Return default profile
      return {
        dealerId,
        callingHoursStart: '08:00:00',
        callingHoursEnd: '20:00:00',
        callingDaysOfWeek: [1, 2, 3, 4, 5, 6],
        maxConcurrentCalls: 3,
        maxCallsPerHour: 50,
        maxAttemptsPerLead: 3,
        retryDelayMinutes: [30, 120, 1440],
        honorDnc: true,
        requireConsent: true,
      };
    }

    return profile;
  }

  /**
   * Check if dealer is within calling window
   */
  async isWithinCallingWindow(dealerId: string, date: Date = new Date()): Promise<boolean> {
    const dealer = await this.getDealer(dealerId);
    const profile = await this.getCallingProfile(dealerId);

    // Convert current time to dealer's timezone
    const zonedDate = toZonedTime(date, dealer.timezone);

    // Check day of week (0 = Sunday, 6 = Saturday)
    const dayOfWeek = getDay(zonedDate);
    if (!profile.callingDaysOfWeek.includes(dayOfWeek)) {
      return false;
    }

    // Check time of day
    const currentHour = getHours(zonedDate);
    const currentMinute = getMinutes(zonedDate);
    const currentTimeMinutes = currentHour * 60 + currentMinute;

    // Parse calling hours
    const [startHour, startMinute] = profile.callingHoursStart.split(':').map(Number);
    const [endHour, endMinute] = profile.callingHoursEnd.split(':').map(Number);

    const startTimeMinutes = startHour * 60 + startMinute;
    const endTimeMinutes = endHour * 60 + endMinute;

    return currentTimeMinutes >= startTimeMinutes && currentTimeMinutes <= endTimeMinutes;
  }

  /**
   * Check if dealer is within calling window (throws if not)
   */
  async checkCallingWindow(dealerId: string, date: Date = new Date()): Promise<void> {
    const isWithin = await this.isWithinCallingWindow(dealerId, date);

    if (!isWithin) {
      const dealer = await this.getDealer(dealerId);
      const profile = await this.getCallingProfile(dealerId);
      const zonedDate = toZonedTime(date, dealer.timezone);
      const dayOfWeek = getDay(zonedDate);

      let reason: string;
      if (!profile.callingDaysOfWeek.includes(dayOfWeek)) {
        reason = `Day of week not allowed (${dayOfWeek})`;
      } else {
        const currentTime = format(zonedDate, 'HH:mm', { timeZone: dealer.timezone });
        reason = `Outside calling hours (current: ${currentTime}, allowed: ${profile.callingHoursStart}-${profile.callingHoursEnd})`;
      }

      throw new CallingWindowError(dealerId, reason);
    }
  }

  /**
   * Get dealer's active phone numbers
   */
  async getActiveNumbers(dealerId: string) {
    const numbers = await this.database.query.dealerNumbers.findMany({
      where: and(eq(dealerNumbers.dealerId, dealerId), eq(dealerNumbers.status, 'active')),
    });

    return numbers;
  }

  /**
   * Get dealer's primary outbound number
   */
  async getPrimaryOutboundNumber(dealerId: string) {
    const numbers = await this.database.query.dealerNumbers.findMany({
      where: and(
        eq(dealerNumbers.dealerId, dealerId),
        eq(dealerNumbers.status, 'active')
      ),
    });

    // Find first number with 'outbound' or 'both' purpose
    const outboundNumber = numbers.find(
      (n) => n.purpose === 'outbound' || n.purpose === 'both'
    );

    if (!outboundNumber) {
      throw new Error(`No outbound phone number found for dealer ${dealerId}`);
    }

    return outboundNumber;
  }

  /**
   * Get current rate limit state for dealer
   * Returns current usage and limits
   */
  async getRateLimitState(dealerId: string) {
    const profile = await this.getCallingProfile(dealerId);

    // TODO: Query active calls and recent calls from database
    // For now, return defaults
    return {
      concurrentCalls: 0,
      maxConcurrentCalls: profile.maxConcurrentCalls,
      callsThisHour: 0,
      maxCallsPerHour: profile.maxCallsPerHour,
      canMakeCall: true,
    };
  }

  /**
   * Check rate limits (throws if exceeded)
   */
  async checkRateLimits(dealerId: string): Promise<void> {
    const state = await this.getRateLimitState(dealerId);

    if (state.concurrentCalls >= state.maxConcurrentCalls) {
      throw new RateLimitError(dealerId, 'concurrent calls');
    }

    if (state.callsThisHour >= state.maxCallsPerHour) {
      throw new RateLimitError(dealerId, 'hourly calls');
    }
  }

  /**
   * Get retry delay for a given attempt number
   */
  async getRetryDelay(dealerId: string, attemptNumber: number): Promise<number> {
    const profile = await this.getCallingProfile(dealerId);

    // Get delay for this attempt (or last delay if attempt exceeds array)
    const delayIndex = Math.min(attemptNumber - 1, profile.retryDelayMinutes.length - 1);
    return profile.retryDelayMinutes[delayIndex] || 1440; // Default 24 hours
  }
}
