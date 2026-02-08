export const creditBonusByRating: Record<string, number> = {
  A: 18,
  B: 12,
  C: 8,
  D: 4,
  E: 0,
};

export const demoWeightByBucket: Record<number, number> = {
  1: 1,
  2: 2,
  3: 3,
  4: 5,
  5: 8,
};

export const hashToInt = (input: string) => {
  let hash = 0;
  for (let i = 0; i < input.length; i += 1) {
    hash = (hash << 5) - hash + input.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
};

export const demoBucketFor = (customerId: string) => (hashToInt(`${customerId}-demo`) % 5) + 1;

export const demoWeightFor = (bucket: number) => demoWeightByBucket[bucket] ?? 1;

export const intentScoreFor = (seed: number, matchScore: number, creditRating: string) => {
  const base = seed % 70;
  const matchBoost = Math.floor(matchScore / 8);
  const creditBoost = creditBonusByRating[creditRating.toUpperCase()] ?? 0;
  return Math.max(0, Math.min(100, base + matchBoost + creditBoost));
};

export const intentTierFor = (score: number) => {
  if (score >= 80) return 'SuperHot';
  if (score >= 60) return 'Hot';
  return 'Warm';
};

export const maskEmail = (email?: string | null) => {
  if (!email) return null;
  const at = email.indexOf('@');
  if (at <= 1) return email;
  return `${email[0]}***${email.slice(at)}`;
};

export const maskPhone = (phone?: string | null) => {
  if (!phone) return null;
  const digits = phone.replace(/\D/g, '');
  if (digits.length < 4) return null;
  return `(***)***-${digits.slice(-4)}`;
};
