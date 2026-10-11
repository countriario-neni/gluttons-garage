"use client";

import { useEffect, useState } from "react";
import type { Settings } from "@/store/DataStore";

type Delivery = Settings["delivery"];

/**
 * Swiggy / Zomato links from cafe settings, rendered only when configured.
 * The store is imported lazily so the public pages don't ship it up front.
 */
export function DeliveryLinks({ className }: { className?: string }) {
  const [delivery, setDelivery] = useState<Delivery | null>(null);

  useEffect(() => {
    let live = true;
    import("@/store")
      .then(({ createStore }) => createStore().getSettings())
      .then((s) => live && setDelivery(s.delivery))
      .catch(() => {});
    return () => {
      live = false;
    };
  }, []);

  const links = [
    { label: "Swiggy", href: delivery?.swiggy },
    { label: "Zomato", href: delivery?.zomato },
  ].filter((l): l is { label: string; href: string } => Boolean(l.href));
  if (!links.length) return null;

  return (
    <div className={className}>
      <h3 className="font-sans text-xs font-bold tracking-[0.2em] text-orange uppercase">Delivery</h3>
      <ul className="mt-3 space-y-1">
        {links.map((l) => (
          <li key={l.label}>
            <a href={l.href} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-11 items-center hover:underline">
              Order on {l.label}
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}
