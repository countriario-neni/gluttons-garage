import { afterEach, describe, expect, it, vi } from "vitest";
import { simulatePayment, upiUri } from "@/integrations/payments/demo";
import { razorpayAvailable } from "@/integrations/payments/razorpay";
import type { PayRequest } from "@/integrations/payments/types";

const req: PayRequest = { orderId: "ord_1", orderCode: "GG-1234", amount: 450, customer: { name: "Asha", phone: "9876543210" } };

describe("upiUri", () => {
  it("builds the demo-only UPI deep link", () => {
    expect(upiUri(req)).toBe(
      "upi://pay?pa=gluttonsgarage.demo@invalid&pn=Gluttons%20Garage&am=450.00&cu=INR&tn=Order%20GG-1234&tr=ord_1",
    );
  });
});

describe("simulatePayment", () => {
  it("succeeds with a pay_DEMO reference", async () => {
    const r = await simulatePayment("card", req, { delayMs: 0 });
    expect(r.success).toBe(true);
    expect(r.channel).toBe("card");
    expect(r.reference).toMatch(/^pay_DEMO[A-Za-z0-9]{14}$/);
    expect(r.failureReason).toBeUndefined();
  });
  it("fails when forceFail is set", async () => {
    const r = await simulatePayment("upi_intent", req, { forceFail: true, delayMs: 0 });
    expect(r.success).toBe(false);
    expect(r.failureReason).toBeTruthy();
  });
  it("fails for the test VPA failure@razorpay on upi_id only", async () => {
    expect((await simulatePayment("upi_id", req, { vpa: "failure@razorpay", delayMs: 0 })).success).toBe(false);
    expect((await simulatePayment("upi_id", req, { vpa: "success@razorpay", delayMs: 0 })).success).toBe(true);
    expect((await simulatePayment("card", req, { vpa: "failure@razorpay", delayMs: 0 })).success).toBe(true);
  });
  it("waits the default delay when delayMs is omitted", async () => {
    vi.useFakeTimers();
    let done = false;
    const p = simulatePayment("wallet", req, {}).then(() => (done = true));
    await vi.advanceTimersByTimeAsync(1399);
    expect(done).toBe(false);
    await vi.advanceTimersByTimeAsync(1);
    await p;
    expect(done).toBe(true);
    vi.useRealTimers();
  });
});

describe("razorpayAvailable", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });
  it("is false without a key", () => {
    vi.stubEnv("NEXT_PUBLIC_RAZORPAY_TEST_KEY", "");
    expect(razorpayAvailable()).toBe(false);
  });
  it("is true for an rzp_test_ key in a browser", () => {
    vi.stubEnv("NEXT_PUBLIC_RAZORPAY_TEST_KEY", "rzp_test_abc123");
    expect(razorpayAvailable()).toBe(true);
  });
  it("rejects live keys", () => {
    vi.stubEnv("NEXT_PUBLIC_RAZORPAY_TEST_KEY", "rzp_live_abc123");
    expect(razorpayAvailable()).toBe(false);
  });
  it("is false when there is no window", () => {
    vi.stubEnv("NEXT_PUBLIC_RAZORPAY_TEST_KEY", "rzp_test_abc123");
    vi.stubGlobal("window", undefined);
    expect(razorpayAvailable()).toBe(false);
  });
});
