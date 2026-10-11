"use client";

import { Plus } from "lucide-react";
import { memo } from "react";
import { DietMark } from "@/components/site/primitives/DietMark";
import { DishPlaceholder } from "@/components/site/primitives/DishPlaceholder";
import { Picture } from "@/components/site/primitives/Picture";
import type { MenuItem } from "@/data/menu";
import { formatINR } from "@/domain/money";
import { imageForSrc } from "@/lib/images";
import { dietOf } from "@/lib/menu";
import { QtyStepper } from "./QtyStepper";

type Props = {
  item: MenuItem;
  /** Total quantity of this dish across cart lines. */
  inCart: number;
  /** Quantity of the plain (no options, no note) line, for the inline stepper on option-less dishes. */
  plainQty: number;
  canAdd: boolean;
  onOpen: (item: MenuItem) => void;
  onAddPlain: (item: MenuItem) => void;
  onSetPlain: (item: MenuItem, qty: number) => void;
};

/** Orderable dish card: text left, photo/placeholder right with the Add control overlapping it. */
export const OrderItemCard = memo(function OrderItemCard({ item, inCart, plainQty, canAdd, onOpen, onAddPlain, onSetPlain }: Props) {
  const img = item.image ? imageForSrc(item.image) : undefined;
  const diet = dietOf(item);
  const custom = item.options.length > 0;
  const soldOut = !item.available;

  return (
    <article
      id={item.id}
      aria-labelledby={`n-${item.id}`}
      className="flex gap-4 rounded-2xl border border-border bg-card p-4 transition-shadow hover:shadow-card data-[sold=true]:opacity-70"
      data-sold={soldOut}
    >
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          {diet && <DietMark diet={diet} />}
          {item.tags.includes("Bestseller") && (
            <span className="rounded-full bg-accent px-2 py-0.5 text-xs font-bold text-accent-foreground">Bestseller</span>
          )}
        </div>
        <h3 id={`n-${item.id}`} className="mt-1.5 text-lg leading-snug font-bold text-primary">
          <button type="button" onClick={() => onOpen(item)} className="text-left hover:underline decoration-orange decoration-2 underline-offset-4">
            {item.name}
          </button>
        </h3>
        <p className="mt-1 font-bold tabular-nums">{formatINR(item.price)}</p>
        {item.description && <p className="mt-1.5 line-clamp-2 text-sm leading-relaxed text-muted-foreground">{item.description}</p>}
        {custom && inCart > 0 && <p className="mt-2 text-xs font-bold text-success">{inCart} in cart</p>}
      </div>

      <div className="relative flex w-28 shrink-0 flex-col items-center sm:w-32">
        <div className="size-28 overflow-hidden rounded-xl sm:size-32">
          {img ? (
            <Picture img={img} sizes="128px" className="size-full object-cover" />
          ) : (
            <DishPlaceholder name={item.name} small className="size-full" />
          )}
        </div>
        <div className="relative z-10 -mt-6 flex flex-col items-center">
          {soldOut ? (
            <span className="inline-flex h-11 items-center rounded-full border border-border bg-secondary px-4 text-sm font-bold text-muted-foreground">
              Sold out
            </span>
          ) : !custom && plainQty > 0 ? (
            <QtyStepper qty={plainQty} onChange={(q) => onSetPlain(item, q)} label={item.name} removable size="sm" className="shadow-card" />
          ) : (
            <button
              type="button"
              aria-label={`Add ${item.name}`}
              disabled={!canAdd}
              onClick={() => (custom ? onOpen(item) : onAddPlain(item))}
              className="inline-flex h-11 items-center gap-1 rounded-full border-2 border-primary bg-card px-5 text-sm font-bold tracking-wide text-primary uppercase shadow-card transition-[background-color,color,transform] hover:bg-primary hover:text-primary-foreground active:scale-95 disabled:pointer-events-none disabled:opacity-50"
            >
              Add <Plus className="size-4" aria-hidden="true" />
            </button>
          )}
          {custom && !soldOut && <span className="mt-1 text-[0.7rem] font-bold text-muted-foreground">Customisable</span>}
        </div>
      </div>
    </article>
  );
});
