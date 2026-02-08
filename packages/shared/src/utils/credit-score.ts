/**
 * Credit Score Utilities
 *
 * Maps letter-based credit ratings to numeric score ranges
 * Implements waterfall scoring system:
 * A = 800+, B = 799-750, C = 749-700, etc.
 */

export interface CreditScoreRange {
  min: number;
  max: number;
  letter: string;
  quality: 'excellent' | 'good' | 'fair' | 'poor' | 'very_poor' | 'unknown';
}

/**
 * Credit rating waterfall mapping
 * Based on standard credit score ranges and dealership conventions
 */
export const CREDIT_RATING_MAP: Record<string, CreditScoreRange> = {
  'A': { min: 800, max: 850, letter: 'A', quality: 'excellent' },
  'B': { min: 750, max: 799, letter: 'B', quality: 'excellent' },
  'C': { min: 700, max: 749, letter: 'C', quality: 'good' },
  'D': { min: 650, max: 699, letter: 'D', quality: 'good' },
  'E': { min: 600, max: 649, letter: 'E', quality: 'fair' },
  'F': { min: 550, max: 599, letter: 'F', quality: 'fair' },
  'G': { min: 500, max: 549, letter: 'G', quality: 'poor' },
  'H': { min: 450, max: 499, letter: 'H', quality: 'poor' },
  'I': { min: 400, max: 449, letter: 'I', quality: 'very_poor' },
  'J': { min: 350, max: 399, letter: 'J', quality: 'very_poor' },
  'K': { min: 300, max: 349, letter: 'K', quality: 'very_poor' },
  'U': { min: 0, max: 0, letter: 'U', quality: 'unknown' }, // Unknown/Unavailable
};

/**
 * Map a letter credit rating to a numeric score range
 *
 * @param letterRating - Single letter credit rating (A-K, U)
 * @returns Credit score range or undefined if invalid
 *
 * @example
 * mapCreditRating('A') // { min: 800, max: 850, letter: 'A', quality: 'excellent' }
 * mapCreditRating('C') // { min: 700, max: 749, letter: 'C', quality: 'good' }
 */
export function mapCreditRating(letterRating: string | null | undefined): CreditScoreRange | undefined {
  if (!letterRating) return undefined;

  const normalized = letterRating.trim().toUpperCase();
  return CREDIT_RATING_MAP[normalized];
}

/**
 * Get the midpoint credit score for a letter rating
 * Useful for sorting and comparison
 *
 * @param letterRating - Single letter credit rating
 * @returns Midpoint score or 0 if unknown/invalid
 *
 * @example
 * getCreditScoreMidpoint('A') // 825
 * getCreditScoreMidpoint('B') // 774.5
 */
export function getCreditScoreMidpoint(letterRating: string | null | undefined): number {
  const range = mapCreditRating(letterRating);
  if (!range || range.letter === 'U') return 0;

  return Math.floor((range.min + range.max) / 2);
}

/**
 * Determine credit quality tier from letter rating
 *
 * @param letterRating - Single letter credit rating
 * @returns Quality tier
 */
export function getCreditQuality(letterRating: string | null | undefined): CreditScoreRange['quality'] {
  const range = mapCreditRating(letterRating);
  return range?.quality || 'unknown';
}

/**
 * Check if a customer qualifies for prime lending (typically C or better)
 *
 * @param letterRating - Single letter credit rating
 * @returns True if qualifies for prime lending
 */
export function isPrimeLending(letterRating: string | null | undefined): boolean {
  const range = mapCreditRating(letterRating);
  if (!range || range.letter === 'U') return false;

  return range.min >= 700; // C rating or better
}

/**
 * Check if a customer qualifies for subprime lending (D-K)
 *
 * @param letterRating - Single letter credit rating
 * @returns True if qualifies for subprime lending
 */
export function isSubprimeLending(letterRating: string | null | undefined): boolean {
  const range = mapCreditRating(letterRating);
  if (!range || range.letter === 'U') return false;

  return range.min >= 300 && range.min < 700;
}

/**
 * Sort leads by credit score (highest to lowest)
 * Useful for prioritizing high-credit leads
 *
 * @param ratings - Array of letter ratings to sort
 * @returns Sorted array (best credit first)
 */
export function sortByCreditScore(ratings: Array<string | null | undefined>): string[] {
  return ratings
    .filter((r): r is string => !!r)
    .sort((a, b) => {
      const scoreA = getCreditScoreMidpoint(a);
      const scoreB = getCreditScoreMidpoint(b);
      return scoreB - scoreA; // Descending order
    });
}
