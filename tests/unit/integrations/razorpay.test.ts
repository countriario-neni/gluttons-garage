import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { PayRequest } from "@/integrations/payments/types";

const req: PayRequest = { orderId: "ord_1", orderCode: "GG-1234", amount: 450, customer: { name: "Asha", phone: "9876543210" } };

type Opts = { handler: (r: { razorpay_payment_id: string }) => void; modal: { ondismiss: () => void } };
type FailCb = (e: { error?: { description?: string } }) => void;

/** Fake Razorpay constructor capturing the options and the payment.failed listener. */
function fakeRazorpay() {
  const ctl: { opts?: Opts; failed?: FailCb; opened: boolean } = { opened: false };
  class Razorpay {
    constructor(o: Opts) {
      ctl.opts = o;
    }
    on(_e: string, cb: FailCb) {
      ctl.failed = cb;
    }
    open() {
      ctl.opened = true;
    }
  }
  return { ctl, Razorpay };
}

const w = () => window as unknown as { Razorpay?: unknown };

async function load() {
  vi.resetModules();
  return import("@/integrations/payments/razorpay");
}

describe("razorpayCheckout", () => {
  beforeEach(() => {
    vi.stubEnv("NEXT_PUBLIC_RAZORPAY_TEST_KEY", "rzp_test_abc123");
    document.head.querySelectorAll("script").forEach((s) => s.remove());
  });
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.useRealTimers();
    delete w().Razorpay;
  });

  it("resolves success immediately from the handler", async () => {
    const { ctl, Razorpay } = fakeRazorpay();
    w().Razorpay = Razorpay;
    const { razorpayCheckout } = await load();
    const p = razorpayCheckout(req);
    await vi.waitFor(() => expect(ctl.opened).toBe(true));
    ctl.opts!.handler({ razorpay_payment_id: "pay_123" });
    await expect(p).resolves.toEqual({ success: true, channel: "card", reference: "pay_123" });
  });

  it("does not resolve on payment.failed; resolves the remembered failure on dismiss", async () => {
    const { ctl, Razorpay } = fakeRazorpay();
    w().Razorpay = Razorpay;
    const { razorpayCheckout } = await load();
    let settled = false;
    const p = razorpayCheckout(req).then((r) => {
      settled = true;
      return r;
    });
    await vi.waitFor(() => expect(ctl.opened).toBe(true));
    ctl.failed!({ error: { description: "Card declined" } });
    await new Promise((r) => setTimeout(r, 10));
    expect(settled).toBe(false); // user may retry inside the modal
    ctl.opts!.modal.ondismiss();
    const r = await p;
    expect(r.success).toBe(false);
    expect(r.failureReason).toBe("Card declined");
  });

  it("a retry that succeeds after a failure resolves success", async () => {
    const { ctl, Razorpay } = fakeRazorpay();
    w().Razorpay = Razorpay;
    const { razorpayCheckout } = await load();
    const p = razorpayCheckout(req);
    await vi.waitFor(() => expect(ctl.opened).toBe(true));
    ctl.failed!({ error: { description: "Card declined" } });
    ctl.opts!.handler({ razorpay_payment_id: "pay_ok" });
    await expect(p).resolves.toMatchObject({ success: true, reference: "pay_ok" });
  });

  it("dismissing without a failure reports a cancellation", async () => {
    const { ctl, Razorpay } = fakeRazorpay();
    w().Razorpay = Razorpay;
    const { razorpayCheckout } = await load();
    const p = razorpayCheckout(req);
    await vi.waitFor(() => expect(ctl.opened).toBe(true));
    ctl.opts!.modal.ondismiss();
    await expect(p).resolves.toMatchObject({ success: false, failureReason: "Payment cancelled" });
  });

  it("fails after a 15 s script-load timeout", async () => {
    vi.useFakeTimers();
    const { razorpayCheckout } = await load();
    let result: unknown;
    void razorpayCheckout(req).then((r) => (result = r));
    await vi.advanceTimersByTimeAsync(14_999);
    expect(result).toBeUndefined();
    await vi.advanceTimersByTimeAsync(1);
    expect(result).toMatchObject({ success: false, channel: "card" });
  });

  it("fails (never throws) when the script loads but window.Razorpay is missing", async () => {
    const { razorpayCheckout } = await load();
    const p = razorpayCheckout(req);
    await vi.waitFor(() => expect(document.head.querySelector("script")).not.toBeNull());
    document.head.querySelector("script")!.dispatchEvent(new Event("load"));
    await expect(p).resolves.toMatchObject({ success: false });
  });

  it("fails when the script errors", async () => {
    const { razorpayCheckout } = await load();
    const p = razorpayCheckout(req);
    await vi.waitFor(() => expect(document.head.querySelector("script")).not.toBeNull());
    document.head.querySelector("script")!.dispatchEvent(new Event("error"));
    await expect(p).resolves.toMatchObject({ success: false });
  });
});
