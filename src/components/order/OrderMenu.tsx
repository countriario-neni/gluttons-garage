"use client";

import { Search, X } from "lucide-react";
import { cn } from "cn";
import { useCallback, useDeferredValue, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { scrollToSettled } from "@/components/site/MenuBrowser";
import { Container } from "@/components/site/primitives/Container";
import { Switch } from "@/components/ui/switch";
import type { MenuCategory, MenuItem } from "@/data/menu";
import type { CartLine } from "@/domain/types";
import { useCart } from "@/lib/cart";
import { filterMenu } from "@/lib/menu";
import { OrderItemCard } from "./OrderItemCard";

const isPlain = (l: CartLine) => l.optionIds.length === 0 && !l.note;

/**
 * Orderable menu: sticky toolbar (mode chip slot, search, veg-only, category tabs with scroll-spy)
 * and content-visibility sections, as on /menu/ so 269 dishes stay fast.
 */
export function OrderMenu({
  items,
  categories,
  canAdd,
  modeChip,
  onOpenItem,
}: {
  items: MenuItem[];
  categories: MenuCategory[];
  canAdd: boolean;
  modeChip: ReactNode;
  onOpenItem: (i: MenuItem) => void;
}) {
  const [query, setQuery] = useState("");
  const [vegOnly, setVegOnly] = useState(false);
  const [active, setActive] = useState<string>(categories[0]?.id ?? "");
  const deferredQuery = useDeferredValue(query);
  const toolbarRef = useRef<HTMLDivElement>(null);
  const chipsRef = useRef<HTMLUListElement>(null);
  const resultsRef = useRef<HTMLDivElement>(null);
  const userFiltered = useRef(false);

  const lines = useCart((s) => s.lines);
  const add = useCart((s) => s.add);
  const setQty = useCart((s) => s.setQty);

  const { inCart, plainQty } = useMemo(() => {
    const inCart = new Map<string, number>();
    const plainQty = new Map<string, number>();
    for (const l of lines) {
      inCart.set(l.itemId, (inCart.get(l.itemId) ?? 0) + l.qty);
      if (isPlain(l)) plainQty.set(l.itemId, l.qty);
    }
    return { inCart, plainQty };
  }, [lines]);

  const onAddPlain = useCallback((i: MenuItem) => add({ itemId: i.id, optionIds: [], qty: 1 }), [add]);
  const onSetPlain = useCallback(
    (i: MenuItem, qty: number) => {
      const idx = useCart.getState().lines.findIndex((l) => l.itemId === i.id && isPlain(l));
      if (idx >= 0) setQty(idx, qty);
    },
    [setQty],
  );

  const sections = useMemo(() => {
    const shown = filterMenu(items, { query: deferredQuery, vegOnly });
    return [...categories]
      .sort((a, b) => a.sort - b.sort)
      .map((c) => ({ ...c, items: shown.filter((i) => i.categoryId === c.id) }))
      .filter((c) => c.items.length > 0);
  }, [items, categories, deferredQuery, vegOnly]);
  const total = sections.reduce((n, s) => n + s.items.length, 0);

  // Scroll-spy: last section whose top has passed under the sticky toolbar.
  useEffect(() => {
    let frame = 0;
    const update = () => {
      frame = 0;
      const els = document.querySelectorAll<HTMLElement>("[data-order-section]");
      const line = (toolbarRef.current?.getBoundingClientRect().bottom ?? 240) + 32;
      let current = els[0]?.id;
      for (const el of els) {
        if (el.getBoundingClientRect().top > line) break;
        current = el.id;
      }
      if (current) setActive(current.replace(/^ocat-/, ""));
    };
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(update);
    };
    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      cancelAnimationFrame(frame);
    };
  }, [sections]);

  // After filtering deep in the list, bring the results back into view.
  useEffect(() => {
    const results = resultsRef.current;
    const toolbar = toolbarRef.current;
    if (!userFiltered.current || !results || !toolbar) return;
    userFiltered.current = false;
    const target = results.getBoundingClientRect().top + window.scrollY - (72 + toolbar.offsetHeight);
    if (window.scrollY > target) window.scrollTo({ top: Math.max(0, target) });
  }, [deferredQuery, vegOnly]);

  // Keep the active tab visible in the horizontal tab bar.
  useEffect(() => {
    const bar = chipsRef.current;
    const chip = bar?.querySelector<HTMLElement>(`[data-chip="${active}"]`);
    if (!bar || !chip) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    bar.scrollTo({ left: chip.offsetLeft - bar.clientWidth / 2 + chip.clientWidth / 2, behavior: reduce ? "auto" : "smooth" });
  }, [active]);

  return (
    <>
      <div ref={toolbarRef} className="sticky top-[4.5rem] z-30 border-b border-border bg-background/95 backdrop-blur">
        <Container className="flex flex-col gap-2.5 py-3 md:flex-row md:items-center md:gap-4">
          <div className="flex items-center gap-3">{modeChip}</div>
          <div className="flex flex-1 items-center gap-3">
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute top-1/2 left-4 size-5 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
              <input
                type="search"
                value={query}
                onChange={(e) => {
                  userFiltered.current = true;
                  setQuery(e.target.value);
                }}
                placeholder="Search dishes…"
                aria-label="Search the menu"
                className="h-11 w-full rounded-full border border-input bg-card pr-11 pl-11 text-base placeholder:text-muted-foreground [&::-webkit-search-cancel-button]:hidden"
              />
              {query && (
                <button
                  type="button"
                  onClick={() => {
                    userFiltered.current = true;
                    setQuery("");
                  }}
                  aria-label="Clear search"
                  className="absolute top-1/2 right-0 grid size-11 -translate-y-1/2 place-items-center rounded-full text-muted-foreground hover:text-foreground"
                >
                  <X className="size-5" aria-hidden="true" />
                </button>
              )}
            </div>
            <label className="flex shrink-0 items-center gap-2.5 text-sm font-bold">
              <Switch
                checked={vegOnly}
                onCheckedChange={(v) => {
                  userFiltered.current = true;
                  setVegOnly(v);
                }}
                aria-label="Veg only"
              />
              <span aria-hidden="true">Veg</span>
            </label>
          </div>
        </Container>
        <nav aria-label="Menu categories" className="border-t border-border/70">
          <ul ref={chipsRef} className="mx-auto flex max-w-7xl gap-1.5 overflow-x-auto px-4 py-2 [scrollbar-width:none] sm:px-6 lg:px-8 [&::-webkit-scrollbar]:hidden">
            {sections.map((c) => (
              <li key={c.id} className="shrink-0">
                <a
                  href={`#ocat-${c.id}`}
                  data-chip={c.id}
                  onClick={(e) => {
                    const el = document.getElementById(`ocat-${c.id}`);
                    if (!el) return;
                    e.preventDefault();
                    scrollToSettled(el);
                  }}
                  aria-current={active === c.id ? "true" : undefined}
                  className={cn(
                    "inline-flex h-11 items-center rounded-full px-4 text-sm font-bold whitespace-nowrap transition-colors",
                    active === c.id ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-secondary hover:text-foreground",
                  )}
                >
                  {c.name}
                </a>
              </li>
            ))}
          </ul>
        </nav>
      </div>

      <Container className="pt-6 pb-36 lg:pt-10">
        <div ref={resultsRef} aria-hidden="true" />
        <p aria-live="polite" className="sr-only">
          {total} {total === 1 ? "dish" : "dishes"}
        </p>
        {total === 0 && (
          <div className="mx-auto max-w-md py-20 text-center">
            <p className="font-[family-name:var(--font-display)] text-2xl font-bold text-primary">Nothing matches that.</p>
            <p className="mt-2 text-muted-foreground">Try a different word{vegOnly ? " or turn off Veg" : ""}.</p>
          </div>
        )}
        <div className="space-y-12">
          {sections.map((c) => (
            <section
              key={c.id}
              id={`ocat-${c.id}`}
              data-order-section
              aria-labelledby={`oh-${c.id}`}
              className="scroll-mt-60 [contain-intrinsic-size:auto_900px] [content-visibility:auto] md:scroll-mt-48"
            >
              <div className="mb-4 flex items-baseline gap-3">
                <h2 id={`oh-${c.id}`} className="text-2xl font-bold text-primary sm:text-3xl">
                  {c.name}
                </h2>
                <span className="text-sm text-muted-foreground">{c.items.length}</span>
              </div>
              <div className="grid gap-3 md:grid-cols-2 md:gap-4 xl:grid-cols-3">
                {c.items.map((i) => (
                  <OrderItemCard
                    key={i.id}
                    item={i}
                    inCart={inCart.get(i.id) ?? 0}
                    plainQty={plainQty.get(i.id) ?? 0}
                    canAdd={canAdd}
                    onOpen={onOpenItem}
                    onAddPlain={onAddPlain}
                    onSetPlain={onSetPlain}
                  />
                ))}
              </div>
            </section>
          ))}
        </div>
      </Container>
    </>
  );
}
