import { describe, it, expect } from "vitest";
import { pointsEarned, maxRedeemablePoints, LOYALTY } from "@/domain/loyalty";

describe("loyalty", () => {
  it("constants", () => expect(LOYALTY).toEqual({ earnPerRupees: 10, redeemBlock: 100, redeemValue: 50, maxShare: 0.5 }));
  it("pointsEarned floors", () => { expect(pointsEarned(999)).toBe(99); expect(pointsEarned(9)).toBe(0); expect(pointsEarned(-5)).toBe(0); });
  it("maxRedeemablePoints", () => {
    expect(maxRedeemablePoints(350, 400)).toBe(300);
    expect(maxRedeemablePoints(350, 100)).toBe(100);
    expect(maxRedeemablePoints(99, 1000)).toBe(0);
    expect(maxRedeemablePoints(1000, 90)).toBe(0);
    expect(maxRedeemablePoints(1000, 0)).toBe(0);
  });
});
