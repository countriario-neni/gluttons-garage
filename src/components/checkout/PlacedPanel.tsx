"use client";

import Link from "next/link";
import { Banknote, CheckCircle2, CreditCard } from "lucide-react";
import { Container } from "@/components/site/primitives/Container";
import { formatINR } from "@/domain/money";
import type { Order } from "@/store/DataStore";

/** After placeOrder: the order exists, its online part is still due. Reopens the payment sheet. */
export function PlacedPanel({
  placed,
  onPay,
  onPayAtCounter,
  onCancel,
}: {
  placed: { order: Order; onlineDue: number };
  onPay: () => void;
  /** Abandon this payment and go back to checkout with whatever is in the cart now. */
  onCancel: () => void;
  onPayAtCounter?: () => void;
}) {
  const { order, onlineDue } = placed;
  return (
    <Container className="max-w-lg py-12 sm:py-16">
      <div className="rounded-3xl border border-border bg-card p-6 text-center shadow-card sm:p-8">
        <CheckCircle2 className="mx-auto size-12 text-success" aria-hidden="true" />
        <h1 className="mt-3 text-3xl font-bold text-primary">Order {order.code} placed</h1>
        <p className="mt-2 text-muted-foreground">
          {formatINR(onlineDue)} is due online{order.bill.total > onlineDue ? `, ${formatINR(order.bill.total - onlineDue)} at the counter` : ""}.
          Complete the payment to finish your order.
        </p>
        <div className="mt-6 flex flex-col gap-2">
          <button
            type="button"
            onClick={onPay}
            className="inline-flex h-12 items-center justify-center gap-2 rounded-full bg-accent font-bold text-accent-foreground shadow-card"
          >
            <CreditCard className="size-5" aria-hidden="true" /> Pay {formatINR(onlineDue)} now
          </button>
          {onPayAtCounter && (
            <button
              type="button"
              onClick={onPayAtCounter}
              className="inline-flex h-12 items-center justify-center gap-2 rounded-full border-2 border-primary font-bold text-primary"
            >
              <Banknote className="size-5" aria-hidden="true" /> Pay at counter instead
            </button>
          )}
          <button
            type="button"
            onClick={onCancel}
            className="mt-2 inline-flex min-h-11 items-center justify-center text-sm font-bold text-primary underline underline-offset-4"
          >
            Cancel this payment and start a new order
          </button>
          <Link href="/order/" className="inline-flex min-h-11 items-center justify-center text-sm font-bold text-primary underline underline-offset-4">
            Back to menu
          </Link>
        </div>
      </div>
    </Container>
  );
}
