"use client";

import { useCallback, useEffect, useRef } from "react";
import type { PayResult } from "@/integrations/payments/types";
import type { DataStore, Order } from "@/store/DataStore";

export type Phase = { kind: "select" } | { kind: "processing" } | { kind: "success"; reference: string } | { kind: "failed"; reason: string };

/**
 * Orders with a payment attempt in flight (or already paid). Module-level, so the guard holds even if the
 * sheet remounts mid-payment: a double tap can never run two attempts for one order.
 */
const inFlight = new Set<string>();

/** Test-only: forget in-flight attempts between tests. */
export const resetPaymentGuard = () => inFlight.clear();

/**
 * Runs one payment attempt and records it with confirmOnlinePayment. Re-entrant calls while an attempt
 * is running are ignored (returns false). A failed attempt releases the guard so "Try again" works;
 * a successful one keeps it, since the order is paid.
 */
export function usePaymentSettle({
  store,
  orderId,
  amount,
  setPhase,
  onPaid,
  holdMs,
}: {
  store: DataStore;
  orderId: string;
  amount: number;
  setPhase: (p: Phase) => void;
  onPaid: (o: Order) => void;
  /** How long the success tick shows before onPaid. */
  holdMs: number;
}) {
  const alive = useRef(true);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);

  return useCallback(
    async (run: () => Promise<PayResult>): Promise<boolean> => {
      if (inFlight.has(orderId)) return false;
      inFlight.add(orderId);
      setPhase({ kind: "processing" });
      let result: PayResult;
      try {
        result = await run();
      } catch {
        result = { success: false, channel: "card", reference: "", failureReason: "The payment could not be started" };
      }
      let updated: Order | null = null;
      try {
        updated = await store.confirmOnlinePayment(orderId, { channel: result.channel, amount, success: result.success, reference: result.reference || "none" });
      } catch {
        if (result.success) result = { ...result, success: false, failureReason: "We couldn't confirm the payment with the café" };
      }
      const paid = result.success && updated !== null;
      if (!paid) inFlight.delete(orderId);
      if (!alive.current) return true;
      if (paid) {
        setPhase({ kind: "success", reference: result.reference });
        setTimeout(() => onPaid(updated!), holdMs);
      } else {
        setPhase({ kind: "failed", reason: result.failureReason ?? "Payment failed" });
      }
      return true;
    },
    [store, orderId, amount, setPhase, onPaid, holdMs],
  );
}
