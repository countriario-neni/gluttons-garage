"use client";

import { Search, X } from "lucide-react";
import { cn } from "cn";
import { useDeferredValue, useEffect, useMemo, useRef, useState } from "react";
import { Switch } from "@/components/ui/switch";
import { categories, items } from "@/data/menu";
import { filterMenu } from "@/lib/menu";
import { MenuItemRow } from "./MenuItemRow";
import { Container } from "./primitives/Container";

/** Full read-only menu: sticky search + veg filter + category chips, sections per category. */
export function MenuBrowser() {
  const [query, setQuery] = useState("");
  const [vegOnly, setVegOnly] = useState(false);
  const [active, setActive] = useState<string>(categories[0].id);
  const deferredQuery = useDeferredValue(query);
  const chipsRef = useRef<HTMLUListElement>(null);
  const toolbarRef = useRef<HTMLDivElement>(null);
  const resultsRef = useRef<HTMLDivElement>(null);

  const sections = useMemo(() => {
    const shown = filterMenu(items, { query: deferredQuery, vegOnly });
    const filtering = Boolean(deferredQuery.trim()) || vegOnly;
    return categories
      .map((c) => ({ ...c, items: shown.filter((i) => i.categoryId === c.id) }))
      .filter((c) => !filtering || c.items.length > 0);
  }, [deferredQuery, vegOnly]);
  const total = sections.reduce((n, s) => n + s.items.length, 0);

  // Scroll-spy: the active category is the last section whose top has reached the sticky toolbar.
  useEffect(() => {
    let frame = 0;
    const update = () => {
      frame = 0;
      const els = document.querySelectorAll<HTMLElement>("[data-menu-section]");
      const line = (toolbarRef.current?.getBoundingClientRect().bottom ?? 240) + 32;
      let current = els[0]?.id;
      for (const el of els) {
        if (el.getBoundingClientRect().top > line) break;
        current = el.id;
      }
      if (current) setActive(current.replace(/^cat-/, ""));
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

  // When the filter changes while scrolled deep into the list, bring the results top back into view.
  useEffect(() => {
    const results = resultsRef.current;
    const toolbar = toolbarRef.current;
    if (!results || !toolbar) return;
    // Where the results start when the toolbar is stuck under the 4.5rem header.
    const target = results.getBoundingClientRect().top + window.scrollY - (72 + toolbar.offsetHeight);
    if (window.scrollY > target) window.scrollTo({ top: Math.max(0, target) });
  }, [deferredQuery, vegOnly]);

  // Keep the active chip in view inside the horizontal chip bar (without scrolling the page).
  useEffect(() => {
    const bar = chipsRef.current;
    const chip = bar?.querySelector<HTMLElement>(`[data-chip="${active}"]`);
    if (!bar || !chip) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    bar.scrollTo({ left: chip.offsetLeft - bar.clientWidth / 2 + chip.clientWidth / 2, behavior: reduce ? "auto" : "smooth" });
  }, [active]);

  return (
    <>
      <div ref={toolbarRef} className="sticky top-[4.5rem] z-30 border-y border-border bg-background/95 backdrop-blur">
        <Container className="flex flex-col gap-3 py-3 sm:flex-row sm:items-center">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute top-1/2 left-4 size-5 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search pancakes, peri peri, soup…"
              aria-label="Search the menu"
              className="h-12 w-full rounded-full border border-input bg-card pr-12 pl-12 text-base placeholder:text-muted-foreground [&::-webkit-search-cancel-button]:hidden"
            />
            {query && (
              <button
                type="button"
                onClick={() => setQuery("")}
                aria-label="Clear search"
                className="absolute top-1/2 right-1 grid size-11 -translate-y-1/2 place-items-center rounded-full text-muted-foreground hover:text-foreground"
              >
                <X className="size-5" aria-hidden="true" />
              </button>
            )}
          </div>
          <div className="flex items-center gap-3 sm:pl-2">
            <Switch checked={vegOnly} onCheckedChange={setVegOnly} aria-labelledby="veg-only-label" />
            <span id="veg-only-label" className="text-sm font-bold">
              Veg only
            </span>
            <p aria-live="polite" className="ml-auto text-sm text-muted-foreground sm:ml-4">
              {total} {total === 1 ? "dish" : "dishes"}
            </p>
          </div>
        </Container>
        <nav aria-label="Menu categories" className="border-t border-border">
          <Container className="px-0 sm:px-0 lg:px-0">
            <ul ref={chipsRef} className="flex gap-2 overflow-x-auto px-4 py-2 [scrollbar-width:none] sm:px-6 lg:px-8 [&::-webkit-scrollbar]:hidden">
              {sections.map((c) => (
                <li key={c.id} className="shrink-0">
                  <a
                    href={`#cat-${c.id}`}
                    data-chip={c.id}
                    aria-current={active === c.id ? "true" : undefined}
                    className={cn(
                      "inline-flex h-11 items-center rounded-full px-4 text-sm font-bold whitespace-nowrap transition-colors",
                      active === c.id ? "bg-primary text-primary-foreground" : "bg-secondary text-secondary-foreground hover:bg-line",
                    )}
                  >
                    {c.name}
                  </a>
                </li>
              ))}
            </ul>
          </Container>
        </nav>
      </div>

      <Container className="py-10 lg:py-14">
        <div ref={resultsRef} aria-hidden="true" />
        {total === 0 && (
          <div className="mx-auto max-w-md py-20 text-center">
            <p className="font-[family-name:var(--font-display)] text-2xl font-bold text-primary">Nothing on the menu matches that.</p>
            <p className="mt-2 text-muted-foreground">Try a different word{vegOnly ? " or turn off Veg only" : ""}.</p>
          </div>
        )}
        <div className="space-y-14">
          {sections.map((c) => (
            <section
              key={c.id}
              id={`cat-${c.id}`}
              data-menu-section
              aria-labelledby={`h-${c.id}`}
              className="scroll-mt-64 sm:scroll-mt-56"
            >
              <div className="mb-5 flex items-baseline gap-3 border-b-2 border-primary pb-3">
                <h2 id={`h-${c.id}`} className="text-3xl font-bold text-primary sm:text-4xl">
                  {c.name}
                </h2>
                <span className="text-sm text-muted-foreground">{c.items.length}</span>
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                {c.items.map((i) => (
                  <MenuItemRow key={i.id} item={i} />
                ))}
              </div>
            </section>
          ))}
        </div>
      </Container>
    </>
  );
}
