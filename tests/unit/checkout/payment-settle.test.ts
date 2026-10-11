import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { resetPaymentGuard, usePaymentSettle, type Phase } from "@/components/checkout/usePaymentSettle";
import type { PayResult } from "@/integrations/payments/types";
import type { DataStore, Order } from "@/store/DataStore";

const order = { id: "ord_1" } as Order;

function setup(confirm = vi.fn(async () => order)) {
  const store = { confirmOnlinePayment: confirm } as unknown as DataStore;
  const phases: Phase[] = [];
  const onPaid = vi.fn();
  const { result, unmount } = renderHook(() =>
    usePaymentSettle({ store, orderId: order.id, amount: 450, setPhase: (p) => phases.push(p), onPaid, holdMs: 0 }),
  );
  return { settle: () => result.current, confirm, phases, onPaid, unmount };
}

const ok = (): Promise<PayResult> => new Promise((r) => setTimeout(() => r({ success: true, channel: "upi_qr", reference: "pay_X" }), 20));
const bad = (): Promise<PayResult> => Promise.resolve({ success: false, channel: "card", reference: "pay_Y", failureReason: "Declined" });

describe("usePaymentSettle", () => {
  beforeEach(() => resetPaymentGuard());

  it("a double tap runs one attempt and confirms once", async () => {
    const t = setup();
    const run = vi.fn(ok);
    await act(async () => {
      const first = t.settle()(run);
      const second = t.settle()(run);
      expect(await second).toBe(false);
      await first;
    });
    expect(run).toHaveBeenCalledTimes(1);
    expect(t.confirm).toHaveBeenCalledTimes(1);
    expect(t.confirm).toHaveBeenCalledWith("ord_1", { channel: "upi_qr", amount: 450, success: true, reference: "pay_X" });
    expect(t.phases.map((p) => p.kind)).toEqual(["processing", "success"]);
  });

  it("stays single-shot across a remount (guard is per order, not per component)", async () => {
    const a = setup();
    const b = setup(a.confirm);
    await act(async () => {
      const first = a.settle()(ok);
      a.unmount();
      expect(await b.settle()(ok)).toBe(false);
      await first;
    });
    expect(a.confirm).toHaveBeenCalledTimes(1);
  });

  it("a failure releases the guard so Try again works", async () => {
    const t = setup();
    await act(async () => {
      await t.settle()(bad);
    });
    expect(t.phases.at(-1)).toEqual({ kind: "failed", reason: "Declined" });
    await act(async () => {
      expect(await t.settle()(ok)).toBe(true);
    });
    expect(t.confirm).toHaveBeenCalledTimes(2);
    expect(t.phases.at(-1)?.kind).toBe("success");
  });

  it("a confirm error turns a gateway success into a failure", async () => {
    const t = setup(vi.fn(async () => {
      throw new Error("ORDER_CLOSED");
    }));
    await act(async () => {
      await t.settle()(ok);
    });
    expect(t.phases.at(-1)?.kind).toBe("failed");
    expect(t.onPaid).not.toHaveBeenCalled();
  });
});
