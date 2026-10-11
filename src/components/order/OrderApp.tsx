"use client";

import { useState } from "react";
import { useShallow } from "zustand/react/shallow";
import { Checkerband } from "@/components/site/primitives/Checkerband";
import { Container } from "@/components/site/primitives/Container";
import type { MenuItem } from "@/data/menu";
import { useCart, useCartHydrated } from "@/lib/cart";
import { StoreProvider } from "@/store";
import { CartBar } from "./CartBar";
import { CartDrawer } from "./CartDrawer";
import { ItemSheet } from "./ItemSheet";
import { ModeChip } from "./ModeChip";
import { ModeSheet } from "./ModeSheet";
import { NotAcceptingBanner } from "./NotAcceptingBanner";
import { OrderMenu } from "./OrderMenu";
import { modeLabel, previewLines, useFabOffset, useMenuAndSettings, useTakeawaySlots } from "./useOrderData";

export function OrderApp() {
  return (
    <StoreProvider>
      <OrderScreen />
    </StoreProvider>
  );
}

function OrderScreen() {
  const hydrated = useCartHydrated();
  const { items, categories, settings } = useMenuAndSettings();
  const { mode, table, pickupTime, lines } = useCart(
    useShallow((s) => ({ mode: s.mode, table: s.table, pickupTime: s.pickupTime, lines: s.lines })),
  );
  const avail = useTakeawaySlots(settings);
  const [modeOpen, setModeOpen] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const [cartOpen, setCartOpen] = useState(false);
  const [openItem, setOpenItem] = useState<MenuItem | null>(null);

  // A takeaway slot saved earlier may have passed: treat it as unset.
  const stale = mode === "takeaway" && !!avail && !!pickupTime && !avail.slots.includes(pickupTime);
  const label = hydrated && !stale ? modeLabel(mode, table, pickupTime) : null;
  const needsMode = hydrated && settings !== null && !label;
  const showMode = modeOpen || (needsMode && !dismissed);

  const accepting = settings?.acceptingOrders !== false;
  const count = lines.reduce((n, l) => n + l.qty, 0);
  const subtotal = previewLines(lines, items).reduce((s, r) => s + r.lineTotal, 0);
  const showBar = hydrated && count > 0;
  useFabOffset(showBar ? 96 : null);

  return (
    <>
      <section className="bg-primary pt-[4.5rem] text-primary-foreground">
        <Container className="py-6 lg:py-8">
          <p className="text-xs font-bold tracking-[0.2em] text-orange uppercase">Order online · Beach Road</p>
          <h1 className="mt-2 text-3xl font-bold sm:text-4xl">What are you craving?</h1>
          <p className="mt-1.5 text-cream/85">Order from your table or for pickup. Pay by UPI, card or at the counter.</p>
        </Container>
        <Checkerband className="h-4 [--checker:8px]" />
      </section>
      {!accepting && <NotAcceptingBanner />}
      <OrderMenu
        items={items}
        categories={categories}
        canAdd={accepting}
        onOpenItem={setOpenItem}
        modeChip={
          hydrated ? (
            <ModeChip mode={mode} label={label} onClick={() => setModeOpen(true)} />
          ) : (
            <span aria-hidden="true" className="inline-block h-11 w-44 animate-pulse rounded-full bg-secondary" />
          )
        }
      />
      {showBar && <CartBar count={count} subtotal={subtotal} onOpenCart={() => setCartOpen(true)} />}
      <ItemSheet item={openItem} canAdd={accepting} onClose={() => setOpenItem(null)} />
      <CartDrawer open={cartOpen} onOpenChange={setCartOpen} menu={items} />
      <ModeSheet
        open={showMode}
        settings={settings}
        onOpenChange={(o) => {
          setModeOpen(o);
          if (!o) setDismissed(true);
        }}
      />
    </>
  );
}
