import { cafe } from "@/data/cafe";
import { waLink } from "@/integrations/whatsapp/templates";
import { withBase } from "@/lib/basePath";

/** Order flow lives at /order/ (Task 8). Plain href so next/link doesn't prefetch it. */
export const orderHref = withBase("/order/");
export const callHref = `tel:${cafe.phoneE164}`;
export const chatHref = waLink(cafe.whatsapp, "Hi Gluttons Garage!");
export const bookHref = waLink(cafe.whatsapp, "Hi Gluttons Garage! I'd like to book a table for __ people on __ at __.");

export const navLinks = [
  { href: "/menu/", label: "Menu" },
  { href: "/#about", label: "About" },
  { href: "/#reviews", label: "Reviews" },
  { href: "/#visit", label: "Visit" },
] as const;
