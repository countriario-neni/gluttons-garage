"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "cn";
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";

type Props = {
  /** Names the list and its buttons, e.g. "Guest favourites". */
  label: string;
  /** Rendered left of the buttons (typically the SectionHeading). */
  heading?: ReactNode;
  children: ReactNode;
  className?: string;
};

/** Horizontal scroll-snap list with previous/next buttons. Children should be <li> items. */
export function Rail({ label, heading, children, className }: Props) {
  const ref = useRef<HTMLUListElement>(null);
  const [edges, setEdges] = useState({ start: true, end: false });

  const measure = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    setEdges({ start: el.scrollLeft <= 4, end: el.scrollLeft + el.clientWidth >= el.scrollWidth - 4 });
  }, []);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    measure();
    el.addEventListener("scroll", measure, { passive: true });
    window.addEventListener("resize", measure);
    return () => {
      el.removeEventListener("scroll", measure);
      window.removeEventListener("resize", measure);
    };
  }, [measure]);

  const page = (dir: 1 | -1) => {
    const el = ref.current;
    if (!el) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    el.scrollBy({ left: dir * el.clientWidth * 0.85, behavior: reduce ? "auto" : "smooth" });
  };

  const btn =
    "grid size-11 place-items-center rounded-full border border-border bg-card text-primary shadow-card transition-colors hover:bg-secondary disabled:pointer-events-none disabled:opacity-40";

  return (
    <div className={className}>
      <div className="mb-8 flex items-end justify-between gap-6">
        {heading}
        <div className="hidden shrink-0 gap-2 sm:flex">
          <button type="button" className={btn} onClick={() => page(-1)} disabled={edges.start} aria-label={`Previous: ${label}`}>
            <ChevronLeft className="size-5" aria-hidden="true" />
          </button>
          <button type="button" className={btn} onClick={() => page(1)} disabled={edges.end} aria-label={`Next: ${label}`}>
            <ChevronRight className="size-5" aria-hidden="true" />
          </button>
        </div>
      </div>
      <ul
        ref={ref}
        aria-label={label}
        className={cn(
          "-mx-4 flex snap-x snap-mandatory gap-4 overflow-x-auto scroll-px-4 px-4 pt-1 pb-6 [scrollbar-width:none] sm:-mx-6 sm:scroll-px-6 sm:px-6 lg:-mx-8 lg:gap-6 lg:scroll-px-8 lg:px-8 [&::-webkit-scrollbar]:hidden",
        )}
      >
        {children}
      </ul>
      <div className="mt-2 flex justify-center gap-2 sm:hidden">
        <button type="button" className={btn} onClick={() => page(-1)} disabled={edges.start} aria-label={`Previous: ${label}`}>
          <ChevronLeft className="size-5" aria-hidden="true" />
        </button>
        <button type="button" className={btn} onClick={() => page(1)} disabled={edges.end} aria-label={`Next: ${label}`}>
          <ChevronRight className="size-5" aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}
