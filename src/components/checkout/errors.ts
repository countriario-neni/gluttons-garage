import { cafe } from "@/data/cafe";

/** Which checkout field an error belongs to, so it can be shown inline next to it. */
export type ErrorField = "name" | "phone" | "coupon" | "points" | "split" | "mode" | "lines" | "form";

const COPY: Record<string, { field: ErrorField; text: string }> = {
  NOT_ACCEPTING: { field: "form", text: `We're not taking online orders right now. Please call us on ${cafe.phone} or order at the counter.` },
  BAD_PHONE: { field: "phone", text: "Enter a 10-digit Indian mobile number." },
  BAD_NAME: { field: "name", text: "Tell us your name (up to 60 characters)." },
  BAD_TABLE: { field: "mode", text: "That table number isn't valid. Please choose your table again." },
  BAD_PICKUP: { field: "mode", text: "Choose a pickup time for your takeaway." },
  CASH_DINE_IN_ONLY: { field: "form", text: "Takeaway orders are paid online. Cash and split are for dine-in." },
  BAD_SPLIT: { field: "split", text: "Enter an online amount between ₹1 and one rupee less than the total." },
  BAD_POINTS: { field: "points", text: "Your points balance has changed. Please review the loyalty discount." },
  COUPON_EXPIRED: { field: "coupon", text: "This coupon has expired." },
  COUPON_INACTIVE: { field: "coupon", text: "This coupon isn't active right now." },
  COUPON_MIN_ORDER: { field: "coupon", text: "Your order is below this coupon's minimum amount." },
  COUPON_LIMIT: { field: "coupon", text: "This coupon has reached its usage limit." },
  COUPON_FIRST_ORDER_ONLY: { field: "coupon", text: "This coupon is for first orders only." },
  COUPON_NOT_FOUND: { field: "coupon", text: "We couldn't find that coupon code." },
  ITEM_UNAVAILABLE: { field: "lines", text: "Sorry, an item in your cart just sold out. Remove it to continue." },
  EMPTY_CART: { field: "lines", text: "Your cart is empty. Add something tasty first." },
  BAD_QTY: { field: "lines", text: "Quantities must be between 1 and 50." },
  BAD_OPTION: { field: "lines", text: "One of your item choices is no longer available. Please remove it and add it again." },
};

const FALLBACK = { field: "form" as const, text: "Something went wrong placing your order. Please try again." };

/** Friendly inline copy for a placeOrder / validateCoupon error code. Coupon reasons may come bare ("EXPIRED"). */
export function errorCopy(code: string): { field: ErrorField; text: string } {
  return COPY[code] ?? COPY[`COUPON_${code}`] ?? FALLBACK;
}

export const ERROR_CODES = Object.keys(COPY);
