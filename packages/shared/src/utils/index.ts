/**
 * Common utility functions
 */

import { customAlphabet } from 'nanoid';

/**
 * Phone number utilities
 */
export const phoneUtils = {
  /**
   * Format phone number to E.164 format
   * Example: (919) 555-1234 -> +19195551234
   */
  toE164(phone: string, defaultCountryCode = '+1'): string {
    // Remove all non-digit characters
    const digits = phone.replace(/\D/g, '');

    // If no country code, add default
    if (digits.length === 10) {
      return `${defaultCountryCode}${digits}`;
    }

    // If 11 digits and starts with 1, add +
    if (digits.length === 11 && digits.startsWith('1')) {
      return `+${digits}`;
    }

    // Otherwise, assume it's already E.164 or return as-is with +
    return digits.startsWith('+') ? digits : `+${digits}`;
  },

  /**
   * Format E.164 phone to display format
   * Example: +19195551234 -> (919) 555-1234
   */
  toDisplay(phone: string): string {
    const digits = phone.replace(/\D/g, '');

    // US/Canada number
    if (digits.length === 11 && digits.startsWith('1')) {
      const areaCode = digits.slice(1, 4);
      const prefix = digits.slice(4, 7);
      const line = digits.slice(7);
      return `(${areaCode}) ${prefix}-${line}`;
    }

    // 10-digit number
    if (digits.length === 10) {
      const areaCode = digits.slice(0, 3);
      const prefix = digits.slice(3, 6);
      const line = digits.slice(6);
      return `(${areaCode}) ${prefix}-${line}`;
    }

    // Return original if can't format
    return phone;
  },

  /**
   * Validate phone number
   */
  isValid(phone: string): boolean {
    const digits = phone.replace(/\D/g, '');
    // Must be 10 digits (US/Canada) or 11 digits starting with 1
    return digits.length === 10 || (digits.length === 11 && digits.startsWith('1'));
  },
};

/**
 * Email validation
 */
export const emailUtils = {
  /**
   * Validate email format
   */
  isValid(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  },

  /**
   * Normalize email (lowercase, trim)
   */
  normalize(email: string): string {
    return email.trim().toLowerCase();
  },
};

/**
 * Generate unique IDs
 */
const nanoid = customAlphabet('0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz', 10);

export const idUtils = {
  /**
   * Generate short unique ID
   */
  generate(): string {
    return nanoid();
  },

  /**
   * Generate trace ID for request correlation
   */
  generateTraceId(): string {
    return `trace_${nanoid()}`;
  },
};

/**
 * Sleep utility
 */
export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Retry utility with exponential backoff
 */
export async function retry<T>(
  fn: () => Promise<T>,
  options: {
    maxAttempts?: number;
    initialDelay?: number;
    maxDelay?: number;
    backoffFactor?: number;
  } = {}
): Promise<T> {
  const {
    maxAttempts = 3,
    initialDelay = 1000,
    maxDelay = 10000,
    backoffFactor = 2,
  } = options;

  let lastError: Error | undefined;
  let delay = initialDelay;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));

      if (attempt === maxAttempts) {
        break;
      }

      await sleep(Math.min(delay, maxDelay));
      delay *= backoffFactor;
    }
  }

  throw lastError || new Error('Retry failed with no error');
}

/**
 * Safe JSON parse
 */
export function safeJsonParse<T = unknown>(json: string, fallback: T): T {
  try {
    return JSON.parse(json) as T;
  } catch {
    return fallback;
  }
}

/**
 * Truncate string with ellipsis
 */
export function truncate(str: string, maxLength: number): string {
  if (str.length <= maxLength) {
    return str;
  }
  return str.slice(0, maxLength - 3) + '...';
}

/**
 * Deep clone object
 */
export function deepClone<T>(obj: T): T {
  return JSON.parse(JSON.stringify(obj)) as T;
}

// Re-export credit score utilities
export * from './credit-score.js';

// Re-export pixel parser utilities
export * from './pixel-parser.js';
