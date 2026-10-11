export const isIndianMobile = (s: string) =>
  /^[6-9]\d{9}$/.test(s.replace(/\D/g, "").slice(-10)) && s.replace(/\D/g, "").length >= 10;

export const isVpa = (s: string) => /^[a-zA-Z0-9.\-_]{2,256}@[a-zA-Z]{2,64}$/.test(s);

export function luhn(num: string): boolean {
  const digits = num.replace(/\s|-/g, "");
  if (!/^\d{12,19}$/.test(digits)) return false;
  let sum = 0;
  for (let i = 0; i < digits.length; i++) {
    let d = Number(digits[digits.length - 1 - i]);
    if (i % 2 === 1) {
      d *= 2;
      if (d > 9) d -= 9;
    }
    sum += d;
  }
  return sum % 10 === 0;
}

export function cardBrand(num: string): "visa" | "mastercard" | "rupay" | "amex" | "unknown" {
  const n = num.replace(/\s|-/g, "");
  if (/^(60|65|81|82|508|353|356)/.test(n)) return "rupay"; // before others: prefixes overlap
  if (/^4/.test(n)) return "visa";
  if (/^(5[1-5]|2(2[2-9]|[3-6]|7[01]|720))/.test(n)) return "mastercard";
  if (/^3[47]/.test(n)) return "amex";
  return "unknown";
}

/** "MM/YY"; valid through the end of that month. */
export function validExpiry(mmYY: string, now: Date): boolean {
  const m = /^(0[1-9]|1[0-2])\/(\d{2})$/.exec(mmYY);
  if (!m) return false;
  const month = Number(m[1]);
  const year = 2000 + Number(m[2]);
  return year * 12 + month >= now.getFullYear() * 12 + now.getMonth() + 1;
}

export function splitRemainder(total: number, online: number): { ok: true; cash: number } | { ok: false; reason: "RANGE" } {
  if (!Number.isInteger(online) || online < 1 || online > total - 1) return { ok: false, reason: "RANGE" };
  return { ok: true, cash: total - online };
}
