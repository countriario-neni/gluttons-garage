import { describe, expect, it } from "vitest";
import { ERROR_CODES, errorCopy } from "@/components/checkout/errors";
import { uuidV4 } from "@/lib/uuid";

const V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

describe("uuidV4", () => {
  it("uses randomUUID when available", () => {
    const c = { randomUUID: () => "fixed", getRandomValues: crypto.getRandomValues.bind(crypto) } as unknown as Crypto;
    expect(uuidV4(c)).toBe("fixed");
  });
  it("falls back to getRandomValues in insecure contexts", () => {
    const id = uuidV4({ getRandomValues: crypto.getRandomValues.bind(crypto) } as unknown as Crypto);
    expect(id).toMatch(V4);
  });
});

describe("errorCopy", () => {
  it("maps every placeOrder code to field-specific copy", () => {
    const codes = ["NOT_ACCEPTING", "BAD_PHONE", "BAD_NAME", "BAD_TABLE", "BAD_PICKUP", "CASH_DINE_IN_ONLY", "BAD_SPLIT", "BAD_POINTS",
      "COUPON_EXPIRED", "COUPON_INACTIVE", "COUPON_MIN_ORDER", "COUPON_LIMIT", "COUPON_FIRST_ORDER_ONLY", "COUPON_NOT_FOUND",
      "ITEM_UNAVAILABLE", "EMPTY_CART", "BAD_QTY", "BAD_OPTION"];
    expect([...ERROR_CODES].sort()).toEqual([...codes].sort());
    for (const c of codes) expect(errorCopy(c).text).not.toMatch(/[A-Z]{2,}_[A-Z]/);
    expect(errorCopy("COUPON_EXPIRED").field).toBe("coupon");
    expect(errorCopy("ITEM_UNAVAILABLE").field).toBe("lines");
    expect(errorCopy("BAD_PHONE").field).toBe("phone");
  });
  it("accepts bare coupon reasons and falls back for unknown codes", () => {
    expect(errorCopy("MIN_ORDER")).toEqual(errorCopy("COUPON_MIN_ORDER"));
    expect(errorCopy("WAT").field).toBe("form");
  });
});
