import type { MenuItem } from "@/data/menu";
import type { Bill, CartLine, Coupon, PricedLine } from "./types";
import { couponDiscount } from "./coupons";
import { LOYALTY, maxRedeemablePoints } from "./loyalty";

/** Option groups where a dish takes at most one pick (Add-ons are multi-select). */
export const SINGLE_CHOICE_GROUPS: ReadonlySet<string> = new Set(["Dressing", "Choice", "Size"]);
const GST_RATE = 0.05;

type PriceError = "ITEM_UNAVAILABLE" | "EMPTY_CART" | "BAD_QTY" | "BAD_OPTION";

/** Prices an order from the menu only; client-supplied prices are never read. */
export function priceOrder(input: {
  lines: CartLine[];
  menu: MenuItem[];
  coupon?: Coupon | null;
  isFirstOrder: boolean;
  pointsToRedeem: number;
  pointsBalance: number;
  now: Date;
}): { ok: true; bill: Bill } | { ok: false; error: PriceError; itemId?: string } {
  if (input.lines.length === 0) return { ok: false, error: "EMPTY_CART" };

  const priced: PricedLine[] = [];
  for (const l of input.lines) {
    if (!Number.isInteger(l.qty) || l.qty < 1 || l.qty > 50) return { ok: false, error: "BAD_QTY", itemId: l.itemId };
    const item = input.menu.find((m) => m.id === l.itemId);
    if (!item || !item.available) return { ok: false, error: "ITEM_UNAVAILABLE", itemId: l.itemId };

    const seen = new Set<string>();
    const groups = new Set<string>();
    let delta = 0;
    const optionLabels: string[] = [];
    for (const oid of l.optionIds) {
      const opt = item.options.find((o) => o.id === oid);
      if (!opt || seen.has(oid)) return { ok: false, error: "BAD_OPTION", itemId: l.itemId };
      seen.add(oid);
      if (SINGLE_CHOICE_GROUPS.has(opt.group)) {
        if (groups.has(opt.group)) return { ok: false, error: "BAD_OPTION", itemId: l.itemId };
        groups.add(opt.group);
      }
      delta += opt.priceDelta;
      optionLabels.push(opt.label);
    }
    const unitPrice = item.price + delta;
    priced.push({
      itemId: l.itemId,
      optionIds: l.optionIds,
      qty: l.qty,
      note: l.note,
      name: item.name,
      unitPrice,
      lineTotal: unitPrice * l.qty,
      optionLabels,
    });
  }

  const subtotal = priced.reduce((s, l) => s + l.lineTotal, 0);
  const cd = input.coupon ? couponDiscount(input.coupon, subtotal, input.isFirstOrder, input.now) : null;
  const couponAmt = cd && cd.ok ? cd.amount : 0;
  const afterCoupon = subtotal - couponAmt;

  const blocks = Math.floor(
    Math.min(Math.max(0, input.pointsToRedeem), maxRedeemablePoints(input.pointsBalance, afterCoupon)) / LOYALTY.redeemBlock,
  );
  const pointsRedeemed = blocks * LOYALTY.redeemBlock;
  const loyaltyDiscount = blocks * LOYALTY.redeemValue;

  const taxable = afterCoupon - loyaltyDiscount;
  const tax = Math.round(taxable * GST_RATE);
  const cgst = Math.floor(tax / 2);
  const sgst = tax - cgst;

  return {
    ok: true,
    bill: { lines: priced, subtotal, couponDiscount: couponAmt, loyaltyDiscount, pointsRedeemed, taxable, cgst, sgst, total: taxable + cgst + sgst },
  };
}
