"use client";

import { Fragment, useEffect, useRef, type ReactNode } from "react";
import { CheckCheck } from "lucide-react";
import { cafe } from "@/data/cafe";
import type { MessageLog } from "@/store/DataStore";
import { clockTime } from "./format";

/**
 * WhatsApp markup to React: `*bold*` becomes <strong>, newlines become <br>. Everything else is plain text
 * (React escapes it), so message bodies never reach the DOM as HTML.
 */
export function renderWhatsApp(body: string): ReactNode {
  return body.split("\n").map((line, i) => (
    <Fragment key={i}>
      {i > 0 && <br />}
      {line.split(/(\*[^*\n]+\*)/).map((part, j) =>
        /^\*[^*\n]+\*$/.test(part) ? <strong key={j}>{part.slice(1, -1)}</strong> : <Fragment key={j}>{part}</Fragment>,
      )}
    </Fragment>
  ));
}

/** Phone mockup with the café's WhatsApp messages for this order, oldest first. */
export function WhatsAppPreview({ messages }: { messages: MessageLog[] }) {
  const scroller = useRef<HTMLDivElement>(null);
  // The store returns newest first (ties newest-inserted first). Reverse, then a stable sort by time keeps ties in insertion order.
  const ordered = [...messages].reverse().sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  const count = ordered.length;
  useEffect(() => {
    const el = scroller.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [count]);

  return (
    <section aria-labelledby="wa-heading" className="rounded-3xl border border-border bg-card p-5 shadow-card sm:p-6">
      <h2 id="wa-heading" className="text-xl font-bold text-primary">
        Live WhatsApp messages (demo preview)
      </h2>
      <p className="mt-1 text-sm text-muted-foreground">In the live version these arrive on your WhatsApp.</p>

      <div className="mx-auto mt-5 w-full max-w-[22rem] rounded-[2.25rem] border-[10px] border-ink bg-ink shadow-lift">
        <div className="overflow-hidden rounded-[1.6rem] bg-cream-dark">
          <div className="flex items-center gap-3 bg-primary px-4 py-3 text-primary-foreground">
            <span aria-hidden="true" className="grid size-9 place-items-center rounded-full bg-accent font-display text-sm font-bold text-accent-foreground">
              GG
            </span>
            <div className="leading-tight">
              <p className="font-bold">{cafe.name}</p>
              <p className="text-xs opacity-90">Business account</p>
            </div>
          </div>
          <div
            ref={scroller}
            tabIndex={0}
            role="log"
            aria-label="Messages from Gluttons Garage"
            className="h-[26rem] space-y-3 overflow-y-auto overscroll-contain bg-cream-dark p-3"
          >
            {ordered.length === 0 && <p className="pt-8 text-center text-sm text-muted-foreground">Messages will appear here.</p>}
            {ordered.map((m) => (
              <div key={m.id} className="relative max-w-[88%] rounded-2xl rounded-tl-sm bg-card px-3 py-2 text-[0.9rem] leading-snug shadow-card">
                <p className="break-words">{renderWhatsApp(m.body)}</p>
                <p className="mt-1 flex items-center justify-end gap-1 text-[0.7rem] text-muted-foreground tabular-nums">
                  {clockTime(m.createdAt)}
                  <CheckCheck className="size-3.5 text-teal" aria-hidden="true" />
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
