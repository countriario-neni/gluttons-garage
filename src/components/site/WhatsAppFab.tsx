"use client";

import { usePathname } from "next/navigation";
import { MessageCircle } from "lucide-react";
import { chatHref } from "./links";

/**
 * Floating WhatsApp chat button, bottom-right. Hidden on staff screens and /track/.
 * Pages with a bottom bar (e.g. the cart, `data-cart-bar`) lift it by setting --fab-offset.
 */
export function WhatsAppFab() {
  const pathname = usePathname();
  // /track/ has its own "Send order on WhatsApp" and "Call café" buttons, and the FAB would cover the bill there.
  if (pathname?.startsWith("/staff") || pathname?.startsWith("/track")) return null;

  return (
    <a
      href={chatHref}
      target="_blank"
      rel="noopener noreferrer"
      data-testid="whatsapp-fab"
      aria-label="Chat with Gluttons Garage on WhatsApp"
      className="group fixed right-4 z-30 grid size-14 place-items-center rounded-full bg-success text-success-foreground shadow-lift transition-transform hover:-translate-y-0.5 bottom-[calc(var(--fab-offset,16px)+env(safe-area-inset-bottom))]"
    >
      <MessageCircle className="size-7" aria-hidden="true" />
      <span
        aria-hidden="true"
        className="pointer-events-none absolute right-full mr-3 rounded-md bg-foreground px-3 py-1.5 text-xs font-bold whitespace-nowrap text-background opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100"
      >
        Chat on WhatsApp
      </span>
    </a>
  );
}
