import { describe, it, expect } from "vitest";
import { isIndianMobile, isVpa, luhn, cardBrand, validExpiry, splitRemainder } from "@/domain/validation";

describe("validation", () => {
  it("isIndianMobile", () => {
    for (const ok of ["9876543210", "+91 98765 43210", "09876543210"]) expect(isIndianMobile(ok)).toBe(true);
    for (const bad of ["12345", "5876543210", ""]) expect(isIndianMobile(bad)).toBe(false);
  });
  it("isVpa", () => { expect(isVpa("name@okhdfc")).toBe(true); expect(isVpa("name")).toBe(false); expect(isVpa("a@b")).toBe(false); });
  it("luhn", () => {
    expect(luhn("4111111111111111")).toBe(true);
    expect(luhn("4111 1111 1111 1111")).toBe(true);
    expect(luhn("4111111111111112")).toBe(false);
    expect(luhn("")).toBe(false);
  });
  it("cardBrand", () => {
    expect(cardBrand("4111111111111111")).toBe("visa");
    expect(cardBrand("5555555555554444")).toBe("mastercard");
    expect(cardBrand("2221000000000009")).toBe("mastercard");
    expect(cardBrand("378282246310005")).toBe("amex");
    expect(cardBrand("6522000000000000")).toBe("rupay");
    expect(cardBrand("6076000000000000")).toBe("rupay");
    expect(cardBrand("1234")).toBe("unknown");
  });
  it("validExpiry", () => {
    const now = new Date(2026, 9, 13);
    expect(validExpiry("01/20", now)).toBe(false);
    expect(validExpiry("09/26", now)).toBe(false);
    expect(validExpiry("10/26", now)).toBe(true);
    expect(validExpiry("12/30", now)).toBe(true);
    expect(validExpiry("13/30", now)).toBe(false);
    expect(validExpiry("1/30", now)).toBe(false);
  });
  it("splitRemainder", () => {
    expect(splitRemainder(500, 500)).toEqual({ ok: false, reason: "RANGE" });
    expect(splitRemainder(500, 0)).toEqual({ ok: false, reason: "RANGE" });
    expect(splitRemainder(500, 499)).toEqual({ ok: true, cash: 1 });
    expect(splitRemainder(500, 200)).toEqual({ ok: true, cash: 300 });
    expect(splitRemainder(500, 1.5)).toEqual({ ok: false, reason: "RANGE" });
  });
});
