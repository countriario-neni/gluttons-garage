"use client";

import { Clock, ShoppingBag, UtensilsCrossed } from "lucide-react";
import { cn } from "cn";
import { useState } from "react";
import { fmt12 } from "@/domain/slots";
import type { OrderMode } from "@/domain/types";
import { useCart } from "@/lib/cart";
import type { Settings } from "@/store/DataStore";
import { ResponsiveSheet, SheetCloseButton, SheetDescription, SheetTitle } from "./ResponsiveSheet";
import { TableGrid } from "./TableGrid";
import { useTakeawaySlots } from "./useOrderData";

const CHOICES: { mode: OrderMode; title: string; hint: string; Icon: typeof ShoppingBag }[] = [
  { mode: "dine_in", title: "Dine-in", hint: "We'll bring it to your table", Icon: UtensilsCrossed },
  { mode: "takeaway", title: "Takeaway", hint: "Pick up at the counter", Icon: ShoppingBag },
];

/** "How are you eating today?" Dine-in table picker or takeaway pickup slots. */
export function ModeSheet({ open, onOpenChange, settings }: { open: boolean; onOpenChange: (o: boolean) => void; settings: Settings | null }) {
  return (
    <ResponsiveSheet open={open} onOpenChange={onOpenChange} size="sm">
      {open && <ModeForm settings={settings} onDone={() => onOpenChange(false)} />}
    </ResponsiveSheet>
  );
}

function ModeForm({ settings, onDone }: { settings: Settings | null; onDone: () => void }) {
  const cart = useCart();
  const [mode, setMode] = useState<OrderMode | null>(cart.mode);
  const [table, setTable] = useState<number | null>(cart.table);
  const [slot, setSlot] = useState<string | null>(cart.pickupTime);
  const avail = useTakeawaySlots(settings);
  const slots = avail?.slots ?? [];
  const slotOk = slot !== null && slots.includes(slot);
  const ready = mode === "dine_in" ? table !== null : mode === "takeaway" ? slotOk : false;

  const confirm = () => {
    if (!ready || !mode) return;
    cart.setMode(mode, mode === "dine_in" ? table : null);
    if (mode === "takeaway") cart.setPickup(slot);
    onDone();
  };

  return (
    <>
      <div className="flex items-start gap-3 px-5 pt-4 sm:px-6 sm:pt-6">
        <div className="flex-1">
          <SheetTitle className="text-2xl font-bold text-primary">How are you eating today?</SheetTitle>
          <SheetDescription className="mt-1 text-sm text-muted-foreground">You can change this any time before you pay.</SheetDescription>
        </div>
        <SheetCloseButton className="-mt-1 -mr-2" />
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5 sm:px-6">
        <div className="grid grid-cols-2 gap-3">
          {CHOICES.map(({ mode: m, title, hint, Icon }) => (
            <button
              key={m}
              type="button"
              aria-pressed={mode === m}
              onClick={() => setMode(m)}
              className={cn(
                "flex flex-col items-start gap-2 rounded-2xl border-2 p-4 text-left transition-colors",
                mode === m ? "border-primary bg-primary/5" : "border-border bg-card hover:border-primary/60",
              )}
            >
              <span className={cn("grid size-10 place-items-center rounded-full", mode === m ? "bg-primary text-primary-foreground" : "bg-secondary text-primary")}>
                <Icon className="size-5" aria-hidden="true" />
              </span>
              <span className="text-lg font-bold text-primary">{title}</span>
              <span className="text-sm text-muted-foreground">{hint}</span>
            </button>
          ))}
        </div>

        {mode === "dine_in" && (
          <section aria-labelledby="pick-table" className="reveal mt-6">
            <h3 id="pick-table" className="mb-3 font-sans text-sm font-bold tracking-wide text-muted-foreground uppercase">
              Your table number
            </h3>
            <TableGrid count={settings?.tables ?? 10} selected={table} onPick={setTable} />
            <p className="mt-3 text-sm text-muted-foreground">It&apos;s on the QR stand at your table.</p>
          </section>
        )}

        {mode === "takeaway" && (
          <section aria-labelledby="pick-slot" className="reveal mt-6">
            <h3 id="pick-slot" className="mb-3 flex items-center gap-2 font-sans text-sm font-bold tracking-wide text-muted-foreground uppercase">
              <Clock className="size-4" aria-hidden="true" /> Pickup time today
            </h3>
            {!avail ? (
              <div className="h-24 animate-pulse rounded-xl bg-secondary" />
            ) : avail.closedLabel ? (
              <div role="status" className="rounded-xl border border-border bg-secondary p-4">
                <p className="font-bold text-primary">Takeaway is closed for today</p>
                <p className="mt-1 text-sm text-muted-foreground">{avail.closedLabel}. Dine-in orders from your table still work.</p>
              </div>
            ) : (
              <div role="radiogroup" aria-labelledby="pick-slot" className="flex flex-wrap gap-2">
                {slots.map((s) => (
                  <label
                    key={s}
                    className={cn(
                      "relative inline-flex h-11 cursor-pointer items-center rounded-full border-2 px-4 text-sm font-bold transition-colors has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-ring",
                      slot === s ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card text-foreground hover:border-primary/60",
                    )}
                  >
                    <input type="radio" name="slot" value={s} checked={slot === s} onChange={() => setSlot(s)} className="absolute inset-0 size-full cursor-pointer appearance-none rounded-full opacity-0" />
                    {fmt12(s)}
                  </label>
                ))}
              </div>
            )}
          </section>
        )}
      </div>
      <div className="border-t border-border bg-card px-5 py-4 pb-[calc(1rem+env(safe-area-inset-bottom))] sm:px-6">
        <button
          type="button"
          onClick={confirm}
          disabled={!ready}
          className="inline-flex h-12 w-full items-center justify-center rounded-full bg-accent font-bold text-accent-foreground shadow-card transition-[opacity,transform] hover:-translate-y-0.5 disabled:translate-y-0 disabled:opacity-50"
        >
          Start ordering
        </button>
      </div>
    </>
  );
}
