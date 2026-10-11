"use client";

import { useEffect, useSyncExternalStore } from "react";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { items as menuItems, type MenuItem } from "@/data/menu";
import { SINGLE_CHOICE_GROUPS } from "@/domain/pricing";
import type { CartLine, OrderMode } from "@/domain/types";

export const CART_KEY = "gg-cart";
export const CART_VERSION = 1;
export const MAX_QTY = 50;
export const MAX_NOTE = 200;

type Persisted = { mode: OrderMode | null; table: number | null; pickupTime: string | null; lines: CartLine[] };

export type CartState = Persisted & {
  add(line: CartLine): void;
  setQty(index: number, qty: number): void;
  remove(index: number): void;
  setMode(mode: OrderMode, table?: number | null): void;
  setPickup(t: string | null): void;
  /** Empties the lines after an order is placed; mode and table stay so the same table can order again. */
  clear(): void;
};

const EMPTY: Persisted = { mode: null, table: null, pickupTime: null, lines: [] };

const cleanNote = (n: unknown): string | undefined => {
  if (typeof n !== "string") return undefined;
  const t = n.trim().slice(0, MAX_NOTE);
  return t || undefined;
};

const normalise = (l: CartLine): CartLine => {
  const note = cleanNote(l.note);
  return { itemId: l.itemId, optionIds: [...l.optionIds].sort(), qty: l.qty, ...(note ? { note } : {}) };
};

/** Identity of a cart line: item + sorted options + note (qty excluded). */
export const lineKey = (l: CartLine): string => JSON.stringify([l.itemId, [...l.optionIds].sort(), cleanNote(l.note) ?? ""]);

/** Adds a line, merging it into an identical one (qty capped at 50). */
export function addLine(lines: CartLine[], line: CartLine): CartLine[] {
  const next = normalise(line);
  const key = lineKey(next);
  const i = lines.findIndex((l) => lineKey(l) === key);
  if (i < 0) return [...lines, { ...next, qty: Math.min(MAX_QTY, next.qty) }];
  return lines.map((l, j) => (j === i ? { ...l, qty: Math.min(MAX_QTY, l.qty + next.qty) } : l));
}

function validLine(raw: unknown, menu: MenuItem[]): CartLine | null {
  if (!raw || typeof raw !== "object") return null;
  const l = raw as Partial<CartLine>;
  if (typeof l.itemId !== "string" || !Array.isArray(l.optionIds)) return null;
  if (!Number.isInteger(l.qty) || l.qty! < 1 || l.qty! > MAX_QTY) return null;
  const item = menu.find((m) => m.id === l.itemId);
  if (!item) return null;
  const seen = new Set<string>();
  const groups = new Set<string>();
  for (const oid of l.optionIds) {
    const opt = typeof oid === "string" ? item.options.find((o) => o.id === oid) : undefined;
    if (!opt || seen.has(opt.id)) return null;
    seen.add(opt.id);
    if (SINGLE_CHOICE_GROUPS.has(opt.group)) {
      if (groups.has(opt.group)) return null;
      groups.add(opt.group);
    }
  }
  return normalise({ itemId: item.id, optionIds: l.optionIds as string[], qty: l.qty!, note: l.note });
}

/** Validates persisted cart data against the current menu: unknown items/options and junk values are dropped. */
export function sanitizeCart(raw: unknown, menu: MenuItem[]): Persisted {
  const s = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const mode = s.mode === "dine_in" || s.mode === "takeaway" ? s.mode : null;
  const table = mode === "dine_in" && Number.isInteger(s.table) && (s.table as number) >= 1 ? (s.table as number) : null;
  const pickupTime = mode === "takeaway" && typeof s.pickupTime === "string" && /^\d{2}:\d{2}$/.test(s.pickupTime) ? s.pickupTime : null;
  const lines = (Array.isArray(s.lines) ? s.lines : [])
    .map((l) => validLine(l, menu))
    .filter((l): l is CartLine => l !== null)
    .reduce<CartLine[]>(addLine, []);
  return { mode, table, pickupTime, lines };
}

export const useCart = create<CartState>()(
  persist(
    (set) => ({
      ...EMPTY,
      add: (line) => set((s) => ({ lines: addLine(s.lines, line) })),
      setQty: (index, qty) =>
        set((s) => ({
          lines:
            qty < 1 ? s.lines.filter((_, i) => i !== index) : s.lines.map((l, i) => (i === index ? { ...l, qty: Math.min(MAX_QTY, Math.floor(qty)) } : l)),
        })),
      remove: (index) => set((s) => ({ lines: s.lines.filter((_, i) => i !== index) })),
      setMode: (mode, table = null) =>
        set(mode === "dine_in" ? { mode, table, pickupTime: null } : { mode, table: null }),
      setPickup: (pickupTime) => set({ pickupTime }),
      clear: () => set({ lines: [] }),
    }),
    {
      name: CART_KEY,
      version: CART_VERSION,
      storage: createJSONStorage(() => localStorage),
      partialize: (s): Persisted => ({ mode: s.mode, table: s.table, pickupTime: s.pickupTime, lines: s.lines }),
      // Unknown (older) shapes are dropped rather than guessed at.
      migrate: () => EMPTY,
      merge: (persisted, current) => ({ ...current, ...sanitizeCart(persisted, menuItems) }),
      // Rehydrated after mount (useCartHydrated) so prerendered HTML and the first client render agree.
      skipHydration: true,
    },
  ),
);

const subscribeHydration = (cb: () => void) => useCart.persist.onFinishHydration(cb);
const hydratedNow = () => useCart.persist.hasHydrated();
const notOnServer = () => false;

/** Restores the saved cart once on the client; true once it is safe to read cart state. */
export function useCartHydrated(): boolean {
  const hydrated = useSyncExternalStore(subscribeHydration, hydratedNow, notOnServer);
  useEffect(() => {
    if (!useCart.persist.hasHydrated()) void useCart.persist.rehydrate();
  }, []);
  return hydrated;
}

/** Hydrate before writing (e.g. the QR landing), so a later rehydrate can't overwrite the change. */
export async function ensureCartHydrated(): Promise<void> {
  if (!useCart.persist.hasHydrated()) await useCart.persist.rehydrate();
}
