import type { Segment } from "@/domain/types";
import type { CustomerStats } from "@/store/DataStore";

export type { Segment };

const DAY_MS = 86_400_000;

export const VIP_SPEND = 5000;
export const VIP_ORDERS = 8;
export const REGULAR_ORDERS = 3;
export const INACTIVE_DAYS = 30;

type Activity = { orders: number; totalSpend: number; lastOrderAt: string | null };

/**
 * Single source of truth for customer tags. `orders` counts non-rejected, non-cancelled orders.
 * Inactive (last order more than 30 days ago) takes precedence over "new". Mirrored in SQL by the
 * customer_stats view (supabase/migrations/0001_schema.sql).
 */
export function tagsFor(s: Activity, now: Date): CustomerStats["tags"] {
  const inactive = s.lastOrderAt !== null && now.getTime() - new Date(s.lastOrderAt).getTime() > INACTIVE_DAYS * DAY_MS;
  const tags: CustomerStats["tags"] = [];
  if (s.orders === 1 && !inactive) tags.push("new");
  if (s.orders >= REGULAR_ORDERS) tags.push("regular");
  if (s.totalSpend >= VIP_SPEND || s.orders >= VIP_ORDERS) tags.push("vip");
  if (inactive) tags.push("inactive");
  return tags;
}

/** Every segment is marketing, so every segment requires opt-in. */
export function inSegment(c: CustomerStats, seg: Segment, now: Date): boolean {
  if (!c.marketingOptIn) return false;
  if (seg === "all_opted_in") return true;
  return tagsFor(c, now).includes(seg === "inactive_30d" ? "inactive" : seg);
}
