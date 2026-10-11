export const roundRupee = (n: number): number => Math.round(n);

const inr = new Intl.NumberFormat("en-IN", { maximumFractionDigits: 0 });

export function formatINR(n: number): string {
  return `₹${inr.format(n)}`;
}
