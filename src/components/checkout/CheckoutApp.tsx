"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { AlertCircle, ArrowLeft, Loader2, ShoppingBag } from "lucide-react";
import { cn } from "cn";
import { useEffect, useRef, useState } from "react";
import { useShallow } from "zustand/react/shallow";
import { ModeChip } from "@/components/order/ModeChip";
import { ModeSheet } from "@/components/order/ModeSheet";
import { modeLabel, previewLines, useFabOffset, useMenuAndSettings, useTakeawaySlots } from "@/components/order/useOrderData";
import { Container } from "@/components/site/primitives/Container";
import { maxRedeemablePoints, pointsEarned } from "@/domain/loyalty";
import { formatINR } from "@/domain/money";
import { priceOrder } from "@/domain/pricing";
import type { Coupon, PaymentPlan } from "@/domain/types";
import { isIndianMobile, splitRemainder } from "@/domain/validation";
import { useCart, useCartHydrated } from "@/lib/cart";
import { uuidV4 } from "@/lib/uuid";
import { StoreProvider, useStore } from "@/store";
import type { Order } from "@/store/DataStore";
import { BillSummary } from "./BillSummary";
import { CheckoutLines } from "./CheckoutLines";
import { CouponField } from "./CouponField";
import { errorCopy, type ErrorField } from "./errors";
import { LoyaltyBox } from "./LoyaltyBox";
import { PaymentSheet } from "./PaymentSheet";
import { PlacedPanel } from "./PlacedPanel";
import { PlanPicker, type PlanKind } from "./PlanPicker";

/** Order placed but the online part is unpaid: survives a reload so payment can resume. */
const PENDING_KEY = "gg-pending-payment";
const digitsOf = (p: string) => p.replace(/\D/g, "").slice(-10);

type Errors = Partial<Record<ErrorField, string>>;
type Placed = { order: Order; onlineDue: number };

export function CheckoutApp() {
  return (
    <StoreProvider>
      <CheckoutScreen />
    </StoreProvider>
  );
}

function Section({ title, step, children, className }: { title: string; step: number; children: React.ReactNode; className?: string }) {
  return (
    <section aria-labelledby={`step-${step}`} className={cn("rounded-3xl border border-border bg-card p-5 shadow-card sm:p-6", className)}>
      <h2 id={`step-${step}`} className="mb-4 flex items-center gap-3 text-xl font-bold text-primary">
        <span aria-hidden="true" className="grid size-7 place-items-center rounded-full bg-primary font-sans text-sm text-primary-foreground">
          {step}
        </span>
        {title}
      </h2>
      {children}
    </section>
  );
}

function CheckoutScreen() {
  const router = useRouter();
  const store = useStore();
  const hydrated = useCartHydrated();
  const { items, settings } = useMenuAndSettings();
  const cart = useCart(useShallow((s) => ({ mode: s.mode, table: s.table, pickupTime: s.pickupTime, lines: s.lines })));
  const { setQty, remove, clear } = useCart(useShallow((s) => ({ setQty: s.setQty, remove: s.remove, clear: s.clear })));
  const avail = useTakeawaySlots(settings);

  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [optIn, setOptIn] = useState(true);
  const [loyalty, setLoyalty] = useState<{ phone: string; points: number; isFirstOrder: boolean; name: string | null } | null>(null);
  const [redeem, setRedeem] = useState(false);
  const [coupon, setCoupon] = useState<Coupon | null>(null);
  const [plan, setPlan] = useState<PlanKind>("online");
  const [splitInput, setSplitInput] = useState("");
  const [errors, setErrors] = useState<Errors>({});
  const [badItemId, setBadItemId] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const pendingRef = useRef(false);
  // One key per checkout attempt; replaced only after a definitive failure (ruling 1).
  const [idemKey, setIdemKey] = useState(() => uuidV4());
  const [placed, setPlaced] = useState<Placed | null>(null);
  const [payOpen, setPayOpen] = useState(false);
  const [modeOpen, setModeOpen] = useState(false);

  // Resume a placed-but-unpaid order after a reload.
  useEffect(() => {
    let id: string | null = null;
    try {
      id = sessionStorage.getItem(PENDING_KEY);
    } catch {}
    if (!id) return;
    void store.getOrder(id).then((o) => {
      const due = o?.payments.find((p) => p.method === "online" && p.status !== "success")?.amount ?? 0;
      if (o && o.paymentStatus !== "paid" && due > 0 && !["rejected", "cancelled", "completed"].includes(o.status)) setPlaced({ order: o, onlineDue: due });
      else sessionStorage.removeItem(PENDING_KEY);
    });
  }, [store]);

  // Loyalty lookup, debounced, for a valid phone.
  const phoneDigits = digitsOf(phone);
  const phoneValid = isIndianMobile(phone);
  useEffect(() => {
    if (!phoneValid) return;
    const t = setTimeout(() => {
      void store.lookupLoyalty(phoneDigits).then((r) => {
        setLoyalty({ phone: phoneDigits, ...r });
        if (r.name) setName((n) => n || r.name!);
      });
    }, 400);
    return () => clearTimeout(t);
  }, [phoneValid, phoneDigits, store]);
  const myLoyalty = loyalty && phoneValid && loyalty.phone === phoneDigits ? loyalty : null;

  const dineIn = cart.mode === "dine_in";
  const stale = cart.mode === "takeaway" && !!avail && !!cart.pickupTime && !avail.slots.includes(cart.pickupTime);
  const label = stale ? null : modeLabel(cart.mode, cart.table, cart.pickupTime);
  const effectivePlan: PlanKind = dineIn ? plan : "online";

  // Live bill preview (the store re-prices authoritatively on placeOrder).
  const now = new Date();
  const base = { lines: cart.lines, menu: items, coupon, isFirstOrder: myLoyalty?.isFirstOrder ?? true, pointsBalance: myLoyalty?.points ?? 0, now };
  const pass1 = priceOrder({ ...base, pointsToRedeem: 0 });
  const redeemable = pass1.ok && myLoyalty ? maxRedeemablePoints(myLoyalty.points, pass1.bill.subtotal - pass1.bill.couponDiscount) : 0;
  const priced = redeem && redeemable > 0 ? priceOrder({ ...base, pointsToRedeem: redeemable }) : pass1;
  const bill = priced.ok ? priced.bill : null;
  const rows = previewLines(cart.lines, items);
  const previewBad = !priced.ok && priced.error === "ITEM_UNAVAILABLE" ? (priced.itemId ?? null) : null;

  const splitAmount = Number(splitInput);
  const splitCheck = bill && splitInput ? splitRemainder(bill.total, splitAmount) : null;

  useFabOffset(placed ? null : 96);

  const fieldErr = (f: ErrorField) => errors[f];
  const clearErr = (f: ErrorField) => setErrors((e) => (e[f] ? { ...e, [f]: undefined } : e));

  const applyCoupon = async (code: string) => {
    clearErr("coupon");
    const r = await store.validateCoupon(code, pass1.ok ? pass1.bill.subtotal : 0, phoneDigits);
    if (r.ok) setCoupon(r.coupon);
    else setErrors((e) => ({ ...e, coupon: errorCopy(r.reason).text }));
  };

  const validate = (): Errors => {
    const e: Errors = {};
    if (!label) e.mode = cart.mode === "takeaway" ? "Choose a pickup time for your takeaway." : "Choose dine-in or takeaway.";
    if (!name.trim()) e.name = "Tell us your name.";
    else if (name.trim().length > 60) e.name = errorCopy("BAD_NAME").text;
    if (!phoneValid) e.phone = errorCopy("BAD_PHONE").text;
    if (!priced.ok) e.lines = errorCopy(priced.error).text;
    if (effectivePlan === "split" && bill && !splitRemainder(bill.total, splitAmount).ok) e.split = errorCopy("BAD_SPLIT").text;
    return e;
  };

  const focusFirst = (e: Errors) => {
    const order: [ErrorField, string][] = [["mode", "mode-anchor"], ["lines", "lines-anchor"], ["name", "name"], ["phone", "phone"], ["coupon", "coupon"], ["points", "phone"], ["split", "split-amount"], ["form", "form-error"]];
    const hit = order.find(([f]) => e[f]);
    const el = hit && document.getElementById(hit[1]);
    if (el) {
      el.scrollIntoView({ block: "center" });
      if (el instanceof HTMLInputElement) el.focus({ preventScroll: true });
    }
  };

  const placeOrder = async () => {
    if (pendingRef.current) return;
    const e = validate();
    setErrors(e);
    setBadItemId(previewBad);
    if (Object.values(e).some(Boolean)) return focusFirst(e);

    pendingRef.current = true;
    setPending(true);
    const p: PaymentPlan =
      effectivePlan === "cash" ? { kind: "cash" } : effectivePlan === "split" ? { kind: "split", onlineAmount: splitAmount } : { kind: "online" };
    try {
      const r = await store.placeOrder({
        idempotencyKey: idemKey,
        name: name.trim(),
        phone: phoneDigits,
        marketingOptIn: optIn,
        mode: cart.mode!,
        table: dineIn ? cart.table : null,
        pickupTime: dineIn ? null : cart.pickupTime,
        lines: cart.lines,
        couponCode: coupon?.code ?? null,
        pointsToRedeem: bill?.pointsRedeemed ?? 0,
        plan: p,
      });
      if (!r.ok) {
        // Definitive rejection: show it inline, keep the cart, and use a fresh key for the next attempt.
        const copy = errorCopy(r.error);
        const next = { [copy.field]: copy.text } as Errors;
        setErrors(next);
        if (r.error === "ITEM_UNAVAILABLE" || r.error === "BAD_OPTION") setBadItemId(previewBad ?? cart.lines[0]?.itemId ?? null);
        if (r.error === "BAD_POINTS") setRedeem(false);
        setIdemKey(uuidV4());
        focusFirst(next);
        return;
      }
      clear();
      if (r.onlineDue > 0) {
        try {
          sessionStorage.setItem(PENDING_KEY, r.order.id);
        } catch {}
        setPlaced({ order: r.order, onlineDue: r.onlineDue });
        setPayOpen(true);
      } else {
        router.push(`/track/?id=${encodeURIComponent(r.order.id)}`);
      }
    } catch {
      // Network/unknown: keep the same key so a retry can't double-order.
      setErrors({ form: "We couldn't reach the café. Check your connection and try again." });
    } finally {
      pendingRef.current = false;
      setPending(false);
    }
  };

  const goTrack = (id: string) => {
    try {
      sessionStorage.removeItem(PENDING_KEY);
    } catch {}
    router.push(`/track/?id=${encodeURIComponent(id)}`);
  };

  if (!hydrated) {
    return (
      <Container className="py-10">
        <div className="h-96 animate-pulse rounded-3xl bg-secondary" />
      </Container>
    );
  }

  if (placed) {
    return (
      <>
        <PlacedPanel placed={placed} onPay={() => setPayOpen(true)} onPayAtCounter={placed.order.mode === "dine_in" ? () => goTrack(placed.order.id) : undefined} />
        <PaymentSheet
          open={payOpen}
          onOpenChange={setPayOpen}
          order={placed.order}
          amount={placed.onlineDue}
          onPaid={(o) => goTrack(o.id)}
          onPayAtCounter={placed.order.mode === "dine_in" ? () => goTrack(placed.order.id) : undefined}
        />
      </>
    );
  }

  if (cart.lines.length === 0) {
    return (
      <Container className="max-w-lg py-16 text-center">
        <ShoppingBag className="mx-auto size-14 text-line" aria-hidden="true" />
        <h1 className="mt-4 text-3xl font-bold text-primary">Your cart is empty</h1>
        <p className="mt-2 text-muted-foreground">Add a few favourites from the menu and come back here to pay.</p>
        <Link href="/order/" className="mt-6 inline-flex h-12 items-center rounded-full bg-accent px-6 font-bold text-accent-foreground shadow-card">
          Browse the menu
        </Link>
      </Container>
    );
  }

  const total = bill?.total ?? 0;
  const buttonLabel =
    effectivePlan === "cash" ? "Place order" : effectivePlan === "split" && splitCheck?.ok ? `Place order · pay ${formatINR(splitAmount)}` : `Place order · pay ${formatINR(total)}`;

  return (
    <Container className="max-w-6xl pt-6 pb-40 lg:pt-10 lg:pb-16">
      <Link href="/order/" className="inline-flex h-11 items-center gap-2 rounded-full pr-3 text-sm font-bold text-primary hover:underline">
        <ArrowLeft className="size-4" aria-hidden="true" /> Back to menu
      </Link>
      <h1 className="mt-1 text-3xl font-bold text-primary sm:text-4xl">Checkout</h1>

      {errors.form && (
        <p id="form-error" role="alert" className="mt-4 flex items-start gap-2 rounded-2xl bg-destructive/10 p-4 font-bold text-destructive">
          <AlertCircle className="mt-0.5 size-5 shrink-0" aria-hidden="true" /> {errors.form}
        </p>
      )}

      <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_24rem] lg:items-start">
        <div className="space-y-6">
          <Section title="Your order" step={1}>
            <div id="mode-anchor" className="mb-2 flex flex-wrap items-center gap-3">
              <ModeChip mode={cart.mode} label={label} onClick={() => setModeOpen(true)} />
              {errors.mode && !label && (
                <p role="alert" className="text-sm font-bold text-destructive">
                  {errors.mode}
                </p>
              )}
            </div>
            <div id="lines-anchor">
              {(errors.lines ?? (previewBad ? errorCopy("ITEM_UNAVAILABLE").text : null)) && (
                <p role="alert" className="mt-3 rounded-xl bg-destructive/10 p-3 text-sm font-bold text-destructive">
                  {errors.lines ?? errorCopy("ITEM_UNAVAILABLE").text}
                </p>
              )}
              <CheckoutLines
                rows={rows}
                badItemId={badItemId ?? previewBad}
                onQty={setQty}
                onRemove={(i) => {
                  remove(i);
                  setBadItemId(null);
                  clearErr("lines");
                }}
              />
            </div>
          </Section>

          <Section title="Your details" step={2}>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label htmlFor="name" className="mb-1.5 block text-sm font-bold">
                  Your name
                </label>
                <input
                  id="name"
                  value={name}
                  onChange={(e) => {
                    setName(e.target.value);
                    clearErr("name");
                  }}
                  autoComplete="name"
                  maxLength={60}
                  placeholder="So we can call out your order"
                  aria-invalid={fieldErr("name") ? true : undefined}
                  aria-describedby={fieldErr("name") ? "name-err" : undefined}
                  className={cn("h-12 w-full rounded-xl border bg-background px-4 text-base placeholder:text-muted-foreground", fieldErr("name") ? "border-destructive" : "border-input")}
                />
                {fieldErr("name") && (
                  <p id="name-err" role="alert" className="mt-1.5 text-sm font-bold text-destructive">
                    {fieldErr("name")}
                  </p>
                )}
              </div>
              <div>
                <label htmlFor="phone" className="mb-1.5 block text-sm font-bold">
                  Mobile number
                </label>
                <div className="relative">
                  <span aria-hidden="true" className="pointer-events-none absolute top-1/2 left-4 -translate-y-1/2 font-bold text-muted-foreground">
                    +91
                  </span>
                  <input
                    id="phone"
                    type="tel"
                    inputMode="numeric"
                    autoComplete="tel-national"
                    value={phone}
                    onChange={(e) => {
                      setPhone(e.target.value.replace(/[^\d\s+-]/g, "").slice(0, 16));
                      clearErr("phone");
                    }}
                    placeholder="98765 43210"
                    aria-invalid={fieldErr("phone") ? true : undefined}
                    aria-describedby={fieldErr("phone") ? "phone-err" : "phone-help"}
                    className={cn("h-12 w-full rounded-xl border bg-background pr-4 pl-14 text-base tracking-wide placeholder:text-muted-foreground", fieldErr("phone") ? "border-destructive" : "border-input")}
                  />
                </div>
                {fieldErr("phone") ? (
                  <p id="phone-err" role="alert" className="mt-1.5 text-sm font-bold text-destructive">
                    {fieldErr("phone")}
                  </p>
                ) : (
                  <p id="phone-help" className="mt-1.5 text-xs text-muted-foreground">
                    For order updates and your reward points.
                  </p>
                )}
              </div>
            </div>
            <label className="mt-4 flex min-h-11 cursor-pointer items-center gap-3">
              <input type="checkbox" checked={optIn} onChange={(e) => setOptIn(e.target.checked)} className="size-5 shrink-0 accent-primary" />
              <span className="text-sm">Send order updates and offers on WhatsApp</span>
            </label>
            {myLoyalty && (
              <div className="reveal mt-4">
                <LoyaltyBox
                  points={myLoyalty.points}
                  redeemable={redeemable}
                  redeem={redeem && redeemable > 0}
                  onRedeem={(v) => {
                    setRedeem(v);
                    clearErr("points");
                  }}
                  earn={bill ? pointsEarned(bill.total) : 0}
                  error={errors.points}
                />
              </div>
            )}
          </Section>

          <Section title="Offers" step={3}>
            <CouponField
              applied={coupon?.code ?? null}
              discount={bill?.couponDiscount ?? 0}
              error={errors.coupon ?? null}
              onApply={applyCoupon}
              onRemove={() => {
                setCoupon(null);
                clearErr("coupon");
              }}
            />
          </Section>

          <Section title="Payment" step={4}>
            <PlanPicker
              dineIn={dineIn}
              plan={effectivePlan}
              onPlan={(p) => {
                setPlan(p);
                clearErr("split");
              }}
              total={total}
              splitInput={splitInput}
              onSplitInput={(v) => {
                setSplitInput(v);
                clearErr("split");
              }}
              splitError={errors.split ?? null}
            />
          </Section>
        </div>

        <aside aria-label="Bill" className="lg:sticky lg:top-24">
          <div className="rounded-3xl border border-border bg-card p-5 shadow-card sm:p-6">
            <h2 className="mb-4 text-xl font-bold text-primary">Bill details</h2>
            {bill ? <BillSummary bill={bill} couponCode={coupon?.code ?? null} /> : <p className="text-sm text-muted-foreground">Fix the highlighted items to see your bill.</p>}
            {effectivePlan === "split" && splitCheck?.ok && (
              <p className="mt-3 rounded-xl bg-secondary p-3 text-sm font-bold">
                Pay {formatINR(splitAmount)} now, {formatINR(splitCheck.cash)} at counter
              </p>
            )}
          </div>
          <div className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-card/95 px-4 pt-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] shadow-lift backdrop-blur lg:static lg:mt-4 lg:border-0 lg:bg-transparent lg:p-0 lg:shadow-none">
            <div className="mx-auto flex max-w-3xl items-center gap-3 lg:block">
              <div className="lg:hidden">
                <p className="text-xs font-bold tracking-wide text-muted-foreground uppercase">To pay</p>
                <p className="text-xl leading-tight font-bold tabular-nums">{formatINR(total)}</p>
              </div>
              <button
                type="button"
                onClick={() => void placeOrder()}
                disabled={pending}
                aria-busy={pending}
                className="inline-flex h-12 flex-1 items-center justify-center gap-2 rounded-full bg-accent px-6 font-bold text-accent-foreground shadow-card transition-[transform,opacity] hover:-translate-y-0.5 disabled:translate-y-0 disabled:opacity-60 lg:h-14 lg:w-full lg:text-lg"
              >
                {pending && <Loader2 className="size-5 animate-spin" aria-hidden="true" />}
                {pending ? "Placing order…" : buttonLabel}
              </button>
            </div>
            <p className="mt-2 hidden text-center text-xs text-muted-foreground lg:block">Total includes 5% GST. Demo mode: no money is charged.</p>
          </div>
        </aside>
      </div>

      <ModeSheet open={modeOpen} onOpenChange={setModeOpen} settings={settings} />
    </Container>
  );
}
