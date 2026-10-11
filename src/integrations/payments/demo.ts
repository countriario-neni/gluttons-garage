import type { PayChannel, PayRequest, PayResult } from "./types";

/** Demo-only payee: the ".invalid" TLD guarantees a scan can never move real money. */
export function upiUri(r: PayRequest): string {
  const q = [
    "pa=gluttonsgarage.demo@invalid",
    "pn=Gluttons%20Garage",
    `am=${r.amount}.00`,
    "cu=INR",
    `tn=${encodeURIComponent(`Order ${r.orderCode}`)}`,
    `tr=${encodeURIComponent(r.orderId)}`,
  ];
  return `upi://pay?${q.join("&")}`;
}

/** Mirrors Razorpay's own test convention: this VPA always fails. */
const FAILURE_VPA = "failure@razorpay";
const ALNUM = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";

function demoReference(): string {
  let s = "pay_DEMO";
  for (let i = 0; i < 14; i++) s += ALNUM[Math.floor(Math.random() * ALNUM.length)];
  return s;
}

export async function simulatePayment(
  channel: PayChannel,
  _r: PayRequest,
  opts: { forceFail?: boolean; delayMs?: number; vpa?: string },
): Promise<PayResult> {
  await new Promise((res) => setTimeout(res, opts.delayMs ?? 1400));
  const fail = !!opts.forceFail || (channel === "upi_id" && opts.vpa?.trim().toLowerCase() === FAILURE_VPA);
  const reference = demoReference();
  return fail
    ? { success: false, channel, reference, failureReason: "Payment declined by the bank (demo)" }
    : { success: true, channel, reference };
}
