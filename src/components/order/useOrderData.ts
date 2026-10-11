"use client";

import { useSyncExternalStore, useEffect } from "react";
import { categories as staticCategories, items as staticItems, type MenuItem } from "@/data/menu";
import type { CartLine, OrderMode } from "@/domain/types";
import { fmt12, openStatus, takeawaySlots } from "@/domain/slots";
import { useCafeClock } from "@/components/site/useCafeClock";
import { useLive } from "@/store";
import type { Settings } from "@/store/DataStore";

/** Live menu (availability can change) + settings; the bundled menu renders until the store answers. */
export function useMenuAndSettings() {
  const { data } = useLive("menu", async (s) => {
    const [menu, settings] = await Promise.all([s.getMenu(), s.getSettings()]);
    return { ...menu, settings };
  });
  return { items: data?.items ?? staticItems, categories: data?.categories ?? staticCategories, settings: data?.settings ?? null };
}

/** Takeaway slots for the rest of today (IST), plus the closed label when there are none. Null until hydrated. */
export function useTakeawaySlots(settings: Settings | null): { slots: string[]; closedLabel: string | null } | null {
  const now = useCafeClock();
  if (!now || !settings) return null;
  const slots = takeawaySlots(now, settings.hours, settings.slotMinutes);
  return { slots, closedLabel: slots.length ? null : openStatus(now, settings.hours).label.replace(/^Closed · /, "Closed now · ") };
}

export function modeLabel(mode: OrderMode | null, table: number | null, pickupTime: string | null): string | null {
  if (mode === "dine_in" && table) return `Dine-in · Table ${table}`;
  if (mode === "takeaway" && pickupTime) return `Takeaway · ${fmt12(pickupTime)}`;
  return null;
}

export type PreviewLine = CartLine & { index: number; name: string; unitPrice: number; lineTotal: number; optionLabels: string[]; available: boolean; item: MenuItem | null };

/** Display-only pricing that never fails (the bill itself always comes from priceOrder). */
export function previewLines(lines: CartLine[], menu: MenuItem[]): PreviewLine[] {
  return lines.map((l, index) => {
    const item = menu.find((m) => m.id === l.itemId) ?? null;
    const opts = item ? item.options.filter((o) => l.optionIds.includes(o.id)) : [];
    const unitPrice = (item?.price ?? 0) + opts.reduce((s, o) => s + o.priceDelta, 0);
    return { ...l, index, item, name: item?.name ?? "Unavailable item", unitPrice, lineTotal: unitPrice * l.qty, optionLabels: opts.map((o) => o.label), available: !!item?.available };
  });
}

const noop = () => () => {};
/** A browser-only value read after hydration (server and first client render get `server`). */
export function useClientValue<T>(read: () => T, server: T): T {
  return useSyncExternalStore(noop, read, () => server);
}

/** Lifts the WhatsApp FAB above a fixed bottom bar while `px` is set. */
export function useFabOffset(px: number | null) {
  useEffect(() => {
    if (px === null) return;
    const root = document.documentElement;
    root.style.setProperty("--fab-offset", `${px}px`);
    return () => {
      root.style.removeProperty("--fab-offset");
    };
  }, [px]);
}
