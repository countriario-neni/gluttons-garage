import type { PayRequest, PayResult } from "./types";

const SCRIPT_SRC = "https://checkout.razorpay.com/v1/checkout.js";

type RazorpayOptions = Record<string, unknown>;
type RazorpayInstance = { open(): void; on(event: "payment.failed", cb: (e: { error?: { description?: string } }) => void): void };
type RazorpayCtor = new (o: RazorpayOptions) => RazorpayInstance;

function testKey(): string {
  return process.env.NEXT_PUBLIC_RAZORPAY_TEST_KEY ?? "";
}

/** Test mode only: live keys are never accepted by the demo. */
export function razorpayAvailable(): boolean {
  return typeof window !== "undefined" && !!testKey() && testKey().startsWith("rzp_test_");
}

let loading: Promise<void> | null = null;
function loadScript(): Promise<void> {
  if ((window as unknown as { Razorpay?: unknown }).Razorpay) return Promise.resolve();
  loading ??= new Promise<void>((resolve, reject) => {
    const s = document.createElement("script");
    s.src = SCRIPT_SRC;
    s.async = true;
    s.onload = () => resolve();
    s.onerror = () => {
      loading = null;
      reject(new Error("Could not load Razorpay checkout"));
    };
    document.head.appendChild(s);
  });
  return loading;
}

function brandColor(): string {
  const v = getComputedStyle(document.documentElement).getPropertyValue("--primary").trim();
  return v || "#5A1F1B";
}

export async function razorpayCheckout(r: PayRequest): Promise<PayResult> {
  const fail = (failureReason: string): PayResult => ({ success: false, channel: "card", reference: "", failureReason });
  if (!razorpayAvailable()) return fail("Razorpay test mode is not configured");
  try {
    await loadScript();
  } catch (e) {
    return fail(e instanceof Error ? e.message : "Could not load Razorpay checkout");
  }
  const Razorpay = (window as unknown as { Razorpay: RazorpayCtor }).Razorpay;
  return new Promise<PayResult>((resolve) => {
    const rz = new Razorpay({
      key: testKey(),
      amount: r.amount * 100,
      currency: "INR",
      name: "Gluttons Garage",
      description: `Order ${r.orderCode}`,
      prefill: { name: r.customer.name, contact: r.customer.phone },
      notes: { orderId: r.orderId },
      theme: { color: brandColor() },
      handler: (res: { razorpay_payment_id: string }) => resolve({ success: true, channel: "card", reference: res.razorpay_payment_id }),
      modal: { ondismiss: () => resolve(fail("Payment cancelled")) },
    });
    rz.on("payment.failed", (e) => resolve(fail(e.error?.description ?? "Payment failed")));
    rz.open();
  });
}
