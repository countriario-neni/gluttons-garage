"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { formatINR } from "@/domain/money";
import { LOYALTY } from "@/domain/loyalty";
import { CouponEditor } from "./CouponEditor";
import { useStaffSession } from "./RequireStaff";

const RULES: { label: string; value: string }[] = [
  { label: "Earn", value: `1 point per ${formatINR(LOYALTY.earnPerRupees)} paid` },
  { label: "Redeem", value: `${LOYALTY.redeemBlock} points = ${formatINR(LOYALTY.redeemValue)}` },
  { label: "Redeem in blocks of", value: `${LOYALTY.redeemBlock} points (minimum ${LOYALTY.redeemBlock})` },
  { label: "Cap", value: `Up to ${LOYALTY.maxShare * 100}% of the bill after any coupon` },
];

/** Owner-only: kitchen staff are sent back to the board. */
export function LoyaltyView() {
  const { role } = useStaffSession();
  const router = useRouter();
  useEffect(() => {
    if (role !== "owner") router.replace("/staff/orders/");
  }, [role, router]);
  if (role !== "owner") return null;

  return (
    <div className="grid gap-6 px-4 py-5 sm:px-6">
      <header>
        <h1 className="font-sans text-3xl font-extrabold tracking-tight">Loyalty &amp; coupons</h1>
        <p className="text-muted-foreground">How customers earn and spend points, and the codes they can use at checkout.</p>
      </header>

      <section aria-labelledby="rules-h" className="grid gap-3">
        <h2 id="rules-h" className="text-xl font-bold">
          Loyalty rules
        </h2>
        <dl className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {RULES.map((r) => (
            <div key={r.label} className="rounded-xl bg-card p-4 shadow-card">
              <dt className="text-sm text-muted-foreground">{r.label}</dt>
              <dd className="mt-1 text-lg font-bold">{r.value}</dd>
            </div>
          ))}
        </dl>
        <p className="text-sm text-muted-foreground">Rules are configurable in the live version.</p>
      </section>

      <CouponEditor />
    </div>
  );
}
