export const LOYALTY = { earnPerRupees: 10, redeemBlock: 100, redeemValue: 50, maxShare: 0.5 };

export function pointsEarned(totalPaid: number): number {
  return Math.max(0, Math.floor(totalPaid / LOYALTY.earnPerRupees));
}

/** Largest multiple of 100 points within balance whose value is <= 50% of base. */
export function maxRedeemablePoints(balance: number, base: number): number {
  const byBalance = Math.floor(balance / LOYALTY.redeemBlock);
  const byShare = Math.floor(Math.floor(base * LOYALTY.maxShare) / LOYALTY.redeemValue);
  return Math.max(0, Math.min(byBalance, byShare)) * LOYALTY.redeemBlock;
}
