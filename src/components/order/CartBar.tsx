"use client";

import Link from "next/link";
import { ChevronRight, ShoppingBag } from "lucide-react";
import { formatINR } from "@/domain/money";

/** Sticky bottom bar: item count + subtotal (opens the cart) and a Checkout link. */
export function CartBar({ count, subtotal, onOpenCart }: { count: number; subtotal: number; onOpenCart: () => void }) {
  return (
    <div data-cart-bar className="reveal fixed inset-x-0 bottom-0 z-40 px-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] sm:px-6">
      <div className="mx-auto flex h-16 max-w-3xl items-center gap-2 rounded-2xl bg-primary p-2 pl-2 text-primary-foreground shadow-lift">
        <button
          type="button"
          onClick={onOpenCart}
          className="flex h-12 min-w-0 flex-1 items-center gap-3 rounded-xl px-3 text-left transition-colors hover:bg-cream/10"
        >
          <span className="relative grid size-10 shrink-0 place-items-center rounded-full bg-cream/15">
            <ShoppingBag className="size-5" aria-hidden="true" />
          </span>
          <span className="min-w-0">
            <span className="block text-xs font-bold tracking-wide text-cream/80 uppercase">
              {count} {count === 1 ? "item" : "items"}
            </span>
            <span className="block text-lg leading-tight font-bold tabular-nums">
              {formatINR(subtotal)} <span className="text-xs font-normal text-cream/80">+ taxes</span>
            </span>
          </span>
          <span className="ml-auto hidden text-sm font-bold underline-offset-4 sm:inline">View cart</span>
          <span className="sr-only sm:hidden">View cart</span>
        </button>
        <Link
          href="/checkout/"
          className="inline-flex h-12 shrink-0 items-center gap-1 rounded-xl bg-accent px-4 font-bold text-accent-foreground transition-transform hover:-translate-y-0.5 sm:px-6"
        >
          Checkout <ChevronRight className="size-5" aria-hidden="true" />
        </Link>
      </div>
    </div>
  );
}
