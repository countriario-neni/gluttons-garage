"use client";

import { Building2, Clock4, CreditCard, Lock, QrCode, Smartphone, Wallet, Zap } from "lucide-react";
import { cn } from "cn";
import { useMemo, useRef, useState, type KeyboardEvent } from "react";
import { ResponsiveSheet, SheetCloseButton, SheetDescription, SheetTitle } from "@/components/order/ResponsiveSheet";
import { useClientValue } from "@/components/order/useOrderData";
import { Switch } from "@/components/ui/switch";
import { formatINR } from "@/domain/money";
import { simulatePayment } from "@/integrations/payments/demo";
import { razorpayAvailable, razorpayCheckout } from "@/integrations/payments/razorpay";
import type { PayChannel, PayRequest } from "@/integrations/payments/types";
import { useStore } from "@/store";
import type { Order } from "@/store/DataStore";
import { CardMethod } from "./methods/CardMethod";
import { NetbankingMethod, PayLaterMethod, WalletMethod } from "./methods/ListMethods";
import { QrMethod } from "./methods/QrMethod";
import type { MethodProps } from "./methods/shared";
import { UpiMethod } from "./methods/UpiMethod";
import { Failed, Processing, Success } from "./PayStatus";
import { usePaymentSettle, type Phase } from "./usePaymentSettle";

const METHODS = [
  { id: "upi", label: "UPI", hint: "GPay, PhonePe, Paytm, BHIM", Icon: Smartphone, Panel: UpiMethod },
  { id: "qr", label: "Scan QR", hint: "Any UPI app", Icon: QrCode, Panel: QrMethod },
  { id: "card", label: "Cards", hint: "Visa, Mastercard, RuPay", Icon: CreditCard, Panel: CardMethod },
  { id: "netbanking", label: "Netbanking", hint: "All major banks", Icon: Building2, Panel: NetbankingMethod },
  { id: "wallet", label: "Wallets", hint: "Paytm, PhonePe, Amazon Pay", Icon: Wallet, Panel: WalletMethod },
  { id: "paylater", label: "Pay Later", hint: "Simpl, LazyPay", Icon: Clock4, Panel: PayLaterMethod },
] as const;
type MethodId = (typeof METHODS)[number]["id"];


/** Shown long enough for the tick to finish before routing to tracking. */
const SUCCESS_HOLD_MS = 1300;
/** Simulated gateway time: 1.2–2 s, like a real authorisation. */
const simDelay = () => 1200 + Math.floor(Math.random() * 800);

/**
 * Razorpay-style payment sheet for a placed order's online part. Bottom sheet on phones, a 720px dialog with
 * a method rail on desktop. Demo payments run through simulatePayment; with a Razorpay test key the real
 * test checkout is offered too. Every outcome is recorded with confirmOnlinePayment.
 */
export function PaymentSheet({
  open,
  onOpenChange,
  order,
  amount,
  onPaid,
  onPayAtCounter,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  order: Order;
  amount: number;
  onPaid: (order: Order) => void;
  /** Dine-in only: leave the online part for the counter. */
  onPayAtCounter?: () => void;
}) {
  const [phase, setPhase] = useState<Phase>({ kind: "select" });
  const busy = phase.kind === "processing" || phase.kind === "success";

  return (
    <ResponsiveSheet
      open={open}
      onOpenChange={(o) => {
        onOpenChange(o);
        if (!o) setPhase({ kind: "select" });
      }}
      size="lg"
      locked={busy}
      className="sm:max-h-[min(46rem,92dvh)]"
    >
      {open && <SheetBody order={order} amount={amount} phase={phase} setPhase={setPhase} onPaid={onPaid} onPayAtCounter={onPayAtCounter} busy={busy} />}
    </ResponsiveSheet>
  );
}

function SheetBody({
  order,
  amount,
  phase,
  setPhase,
  onPaid,
  onPayAtCounter,
  busy,
}: {
  order: Order;
  amount: number;
  phase: Phase;
  setPhase: (p: Phase) => void;
  onPaid: (order: Order) => void;
  onPayAtCounter?: () => void;
  busy: boolean;
}) {
  const store = useStore();
  const [method, setMethod] = useState<MethodId>("upi");
  const [forceFail, setForceFail] = useState(false);
  const rzp = useClientValue(razorpayAvailable, false);
  const desktop = useClientValue(() => window.matchMedia("(min-width: 640px)").matches, false);
  const tabRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  const req: PayRequest = useMemo(
    () => ({ orderId: order.id, orderCode: order.code, amount, customer: { name: order.customerName, phone: order.phone } }),
    [order.id, order.code, order.customerName, order.phone, amount],
  );

  const settle = usePaymentSettle({ store, orderId: order.id, amount, setPhase, onPaid, holdMs: SUCCESS_HOLD_MS });

  const onPay: MethodProps["onPay"] = (channel: PayChannel, opts) =>
    void settle(() => simulatePayment(channel, req, { forceFail, vpa: opts?.vpa, delayMs: simDelay() }));

  const onKeyDown = (e: KeyboardEvent) => {
    const i = METHODS.findIndex((m) => m.id === method);
    const next = { ArrowDown: i + 1, ArrowRight: i + 1, ArrowUp: i - 1, ArrowLeft: i - 1, Home: 0, End: METHODS.length - 1 }[e.key];
    if (next === undefined) return;
    e.preventDefault();
    const m = METHODS[(next + METHODS.length) % METHODS.length];
    setMethod(m.id);
    tabRefs.current[m.id]?.focus();
  };

  const active = METHODS.find((m) => m.id === method)!;
  const Panel = active.Panel;

  return (
    <>
      {/* Header: payee, order code, amount */}
      <div className="flex items-center gap-3 border-b border-border px-5 pt-2 pb-4 sm:px-6 sm:pt-5">
        <span aria-hidden="true" className="grid size-11 shrink-0 place-items-center rounded-xl bg-primary font-[family-name:var(--font-wordmark)] text-lg text-primary-foreground">
          G
        </span>
        <div className="min-w-0 flex-1">
          <SheetTitle className="truncate text-lg leading-tight font-bold text-foreground">
            <span className="sr-only">Pay {formatINR(amount)} to </span>Gluttons Garage
          </SheetTitle>
          <SheetDescription className="text-sm text-muted-foreground">Order {order.code}</SheetDescription>
        </div>
        <div className="text-right">
          <p className="text-xs font-bold tracking-wide text-muted-foreground uppercase">Amount</p>
          <p className="text-2xl leading-tight font-bold text-primary tabular-nums">{formatINR(amount)}</p>
        </div>
        <SheetCloseButton className="-mr-2" disabled={busy} label="Close payment" />
      </div>

      {phase.kind === "processing" && <Processing amount={amount} />}
      {phase.kind === "success" && <Success amount={amount} reference={phase.reference} />}
      {phase.kind === "failed" && <Failed reason={phase.reason} onRetry={() => setPhase({ kind: "select" })} onPayAtCounter={onPayAtCounter} />}

      {phase.kind === "select" && (
        <div className="flex min-h-0 flex-1 flex-col sm:grid sm:grid-cols-[15rem_1fr]">
          <div
            role="tablist"
            aria-label="Payment methods"
            aria-orientation={desktop ? "vertical" : "horizontal"}
            onKeyDown={onKeyDown}
            className="flex shrink-0 gap-2 overflow-x-auto border-b border-border px-5 py-3 [scrollbar-width:none] sm:flex-col sm:gap-1 sm:overflow-y-auto sm:border-r sm:border-b-0 sm:bg-secondary/40 sm:px-3 sm:py-4 [&::-webkit-scrollbar]:hidden"
          >
            {METHODS.map((m) => {
              const selected = m.id === method;
              return (
                <button
                  key={m.id}
                  ref={(el) => {
                    tabRefs.current[m.id] = el;
                  }}
                  type="button"
                  role="tab"
                  id={`paytab-${m.id}`}
                  aria-selected={selected}
                  aria-controls={`paypanel-${m.id}`}
                  tabIndex={selected ? 0 : -1}
                  onClick={() => setMethod(m.id)}
                  className={cn(
                    "flex h-11 shrink-0 items-center gap-2 rounded-full border px-4 text-sm font-bold whitespace-nowrap transition-colors sm:h-auto sm:min-h-14 sm:w-full sm:rounded-xl sm:border-0 sm:px-3 sm:py-2 sm:text-left",
                    selected
                      ? "border-primary bg-primary text-primary-foreground sm:bg-card sm:text-primary sm:shadow-card"
                      : "border-border bg-card text-foreground hover:border-primary/50 sm:bg-transparent sm:hover:bg-card/70",
                  )}
                >
                  <m.Icon className="size-4 shrink-0 sm:size-5" aria-hidden="true" />
                  <span className="sm:flex-1">
                    <span className="block">{m.label}</span>
                    <span className={cn("hidden text-xs font-normal sm:block", selected ? "text-muted-foreground" : "text-muted-foreground")}>{m.hint}</span>
                  </span>
                </button>
              );
            })}
          </div>

          <div
            role="tabpanel"
            id={`paypanel-${active.id}`}
            aria-labelledby={`paytab-${active.id}`}
            tabIndex={0}
            className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 py-5 outline-none sm:h-[min(33rem,calc(92dvh-8.5rem))] sm:px-6"
          >
            {rzp && (
              <div className="mb-6 rounded-2xl border-2 border-primary bg-primary/5 p-4">
                <button
                  type="button"
                  onClick={() => void settle(() => razorpayCheckout(req))}
                  className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-full bg-primary font-bold text-primary-foreground shadow-card"
                >
                  <Zap className="size-4" aria-hidden="true" /> Pay with Razorpay (test mode)
                </button>
                <p className="mt-2 text-center text-xs text-muted-foreground">Real Razorpay test checkout. Use Razorpay&apos;s test cards or UPI IDs.</p>
              </div>
            )}
            <Panel key={active.id} req={req} onPay={onPay} />
          </div>
        </div>
      )}

      <div className="flex flex-col gap-2 border-t border-border bg-secondary/50 px-5 py-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <p className="flex items-center gap-1.5">
          <Lock className="size-3.5 shrink-0" aria-hidden="true" />
          <span>
            Secured by Razorpay · <span className="font-bold text-foreground">Demo mode — no money is charged</span>
          </span>
        </p>
        {phase.kind === "select" && (
          <label className="flex items-center gap-2.5 self-start font-bold sm:self-auto">
            <Switch size="sm" checked={forceFail} onCheckedChange={setForceFail} aria-label="Simulate failure (demo)" />
            <span aria-hidden="true">Simulate failure</span>
          </label>
        )}
      </div>
    </>
  );
}
