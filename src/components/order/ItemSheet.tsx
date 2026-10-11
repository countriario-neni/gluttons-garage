"use client";

import { cn } from "cn";
import { useId, useMemo, useState } from "react";
import { DietMark } from "@/components/site/primitives/DietMark";
import { DishPlaceholder } from "@/components/site/primitives/DishPlaceholder";
import { Picture } from "@/components/site/primitives/Picture";
import type { MenuItem, MenuOption } from "@/data/menu";
import { formatINR } from "@/domain/money";
import { SINGLE_CHOICE_GROUPS } from "@/domain/pricing";
import { MAX_NOTE, useCart } from "@/lib/cart";
import { imageForSrc } from "@/lib/images";
import { dietOf } from "@/lib/menu";
import { QtyStepper } from "./QtyStepper";
import { ResponsiveSheet, SheetCloseButton, SheetDescription, SheetTitle } from "./ResponsiveSheet";

type Group = { name: string; single: boolean; options: MenuOption[] };

function groupsOf(item: MenuItem): Group[] {
  const map = new Map<string, MenuOption[]>();
  for (const o of item.options) map.set(o.group, [...(map.get(o.group) ?? []), o]);
  // Required choices first, add-ons after.
  return [...map.entries()]
    .map(([name, options]) => ({ name, single: SINGLE_CHOICE_GROUPS.has(name), options }))
    .sort((a, b) => Number(b.single) - Number(a.single));
}

/** Dish detail: required single choices (base pre-selected), add-ons, note, quantity and live price. */
export function ItemSheet({ item, canAdd = true, onClose }: { item: MenuItem | null; canAdd?: boolean; onClose: () => void }) {
  return (
    <ResponsiveSheet open={item !== null} onOpenChange={(o) => !o && onClose()} size="sm">
      {item && <ItemForm key={item.id} item={item} canAdd={canAdd} onDone={onClose} />}
    </ResponsiveSheet>
  );
}

function ItemForm({ item, canAdd, onDone }: { item: MenuItem; canAdd: boolean; onDone: () => void }) {
  const add = useCart((s) => s.add);
  const groups = useMemo(() => groupsOf(item), [item]);
  const [picks, setPicks] = useState<Record<string, string>>(() =>
    Object.fromEntries(
      groups.filter((g) => g.single).map((g) => [g.name, (g.options.find((o) => o.priceDelta === 0) ?? g.options[0]).id]),
    ),
  );
  const [addOns, setAddOns] = useState<Set<string>>(new Set());
  const [note, setNote] = useState("");
  const [qty, setQty] = useState(1);
  const noteId = useId();
  const img = item.image ? imageForSrc(item.image) : undefined;
  const diet = dietOf(item);

  const optionIds = [...Object.values(picks), ...addOns];
  const unit = item.price + item.options.filter((o) => optionIds.includes(o.id)).reduce((s, o) => s + o.priceDelta, 0);

  const toggleAddOn = (id: string) =>
    setAddOns((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });

  const submit = () => {
    add({ itemId: item.id, optionIds, qty, note });
    onDone();
  };

  return (
    <>
      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
        <div className="relative">
          <div className={cn("w-full overflow-hidden bg-secondary", img ? "aspect-[16/9] sm:aspect-[2/1]" : "aspect-[3/1]")}>
            {img ? (
              <Picture img={img} sizes="(min-width: 640px) 480px, 100vw" className="size-full object-cover" />
            ) : (
              <DishPlaceholder name={item.name} className="size-full" />
            )}
          </div>
          <SheetCloseButton className="absolute top-3 right-3 bg-card/90 text-foreground shadow-card backdrop-blur" />
        </div>

        <div className="px-5 pt-5 sm:px-6">
          {diet && <DietMark diet={diet} />}
          <SheetTitle className="mt-1.5 text-2xl leading-tight font-bold text-primary">{item.name}</SheetTitle>
          <p className="mt-1 text-lg font-bold">{formatINR(item.price)}</p>
          {item.description ? (
            <SheetDescription className="mt-2 text-sm leading-relaxed text-muted-foreground">{item.description}</SheetDescription>
          ) : (
            <SheetDescription className="sr-only">Choose options and quantity</SheetDescription>
          )}
          {item.nutrition && (
            <p className="mt-2 text-xs text-muted-foreground">
              <span className="font-bold text-foreground">{Math.round(item.nutrition.kcal)} kcal</span> · Protein {item.nutrition.protein} g ·
              Carbs {item.nutrition.carbs} g · Fat {item.nutrition.fat} g
            </p>
          )}
        </div>

        {groups.map((g) => (
          <fieldset key={g.name} className="mt-6 border-t border-border px-5 pt-5 sm:px-6">
            <legend className="sr-only">{g.name}</legend>
            <div aria-hidden="true" className="mb-2 flex items-baseline justify-between gap-3">
              <span className="text-base font-bold text-foreground">{g.name}</span>
              <span
                className={cn(
                  "rounded-full px-2.5 py-0.5 text-xs font-bold",
                  g.single ? "bg-accent text-accent-foreground" : "bg-secondary text-muted-foreground",
                )}
              >
                {g.single ? "Required · pick 1" : "Optional"}
              </span>
            </div>
            <ul className="divide-y divide-border">
              {g.options.map((o) => {
                const checked = g.single ? picks[g.name] === o.id : addOns.has(o.id);
                return (
                  <li key={o.id}>
                    <label className="flex min-h-12 cursor-pointer items-center gap-3 py-1.5">
                      <input
                        type={g.single ? "radio" : "checkbox"}
                        name={g.single ? `${item.id}-${g.name}` : undefined}
                        checked={checked}
                        onChange={() => (g.single ? setPicks((p) => ({ ...p, [g.name]: o.id })) : toggleAddOn(o.id))}
                        className={cn("size-5 shrink-0 accent-primary", !g.single && "rounded")}
                      />
                      <span className="flex-1 text-[0.95rem] first-letter:uppercase">{o.label}</span>
                      <span className="text-sm font-bold text-muted-foreground tabular-nums">
                        {o.priceDelta > 0 ? `+${formatINR(o.priceDelta)}` : g.single ? "" : "Free"}
                      </span>
                    </label>
                  </li>
                );
              })}
            </ul>
          </fieldset>
        ))}

        <div className="mt-6 border-t border-border px-5 pt-5 pb-6 sm:px-6">
          <label htmlFor={noteId} className="text-base font-bold">
            Note for the kitchen <span className="font-normal text-muted-foreground">(optional)</span>
          </label>
          <textarea
            id={noteId}
            value={note}
            onChange={(e) => setNote(e.target.value.slice(0, MAX_NOTE))}
            maxLength={MAX_NOTE}
            rows={2}
            placeholder="Less spicy, no onion…"
            className="mt-2 w-full resize-none rounded-xl border border-input bg-background px-4 py-3 text-base placeholder:text-muted-foreground"
          />
          <p className="mt-1 text-right text-xs text-muted-foreground tabular-nums">
            {note.length}/{MAX_NOTE}
          </p>
        </div>
      </div>

      <div className="flex items-center gap-3 border-t border-border bg-card px-5 py-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] sm:px-6">
        <QtyStepper qty={qty} onChange={(q) => setQty(Math.max(1, q))} />
        <button
          type="button"
          onClick={submit}
          disabled={!item.available || !canAdd}
          className="inline-flex h-12 flex-1 items-center justify-between gap-3 rounded-full bg-primary px-5 font-bold text-primary-foreground shadow-card transition-transform hover:-translate-y-0.5 disabled:opacity-50"
        >
          <span>{!item.available ? "Sold out" : canAdd ? "Add to cart" : "Ordering paused"}</span>
          <span className="tabular-nums">{formatINR(unit * qty)}</span>
        </button>
      </div>
    </>
  );
}
