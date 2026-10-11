"use client";

import { MapPin, MessageCircle, Navigation, Phone } from "lucide-react";
import { cn } from "cn";
import { cafe } from "@/data/cafe";
import { fmt12 } from "@/domain/slots";
import { callHref, chatHref } from "./links";
import { Container } from "./primitives/Container";
import { Reveal } from "./primitives/Reveal";
import { SectionHeading } from "./primitives/SectionHeading";
import { useCafeClock } from "./useCafeClock";

/** Monday-first week; keys are JS days (0 = Sunday). */
const week = [
  [1, "Monday"],
  [2, "Tuesday"],
  [3, "Wednesday"],
  [4, "Thursday"],
  [5, "Friday"],
  [6, "Saturday"],
  [0, "Sunday"],
] as const;

const btn = "inline-flex h-12 items-center justify-center gap-2 rounded-full px-5 font-bold transition-transform hover:-translate-y-0.5";

export function Visit() {
  // Today's row is highlighted after hydration (IST), so the static HTML stays neutral.
  const today = useCafeClock()?.getDay() ?? null;

  return (
    <section id="visit" aria-labelledby="visit-title" className="scroll-mt-20 bg-secondary py-16 lg:py-24">
      <Container className="grid gap-10 lg:grid-cols-[1fr_1.15fr] lg:gap-14">
        <div>
          <SectionHeading id="visit-title" eyebrow="Find us" title="Pull into the garage" />
          <address className="mt-6 flex gap-3 text-lg not-italic">
            <MapPin className="mt-1 size-5 shrink-0 text-primary" aria-hidden="true" />
            {cafe.address}
          </address>

          <table className="mt-8 w-full max-w-md text-left">
            <caption className="mb-2 text-left text-xs font-bold tracking-[0.2em] text-primary uppercase">Opening hours</caption>
            <tbody>
              {week.map(([day, name]) => {
                const h = cafe.hours[day];
                const isToday = day === today;
                return (
                  <tr
                    key={day}
                    aria-current={isToday ? "date" : undefined}
                    className={cn("border-b border-border", isToday && "bg-card font-bold text-primary")}
                  >
                    <th scope="row" className="py-2.5 pl-3 font-[inherit]">
                      {name}
                      {isToday && <span className="ml-2 rounded-full bg-accent px-2 py-0.5 text-xs text-accent-foreground">Today</span>}
                    </th>
                    <td className="py-2.5 pr-3 text-right tabular-nums">
                      {h ? `${fmt12(h.open)} – ${fmt12(h.close)}` : "Closed"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          <div className="mt-8 flex flex-wrap gap-3">
            <a href={callHref} className={`${btn} bg-primary text-primary-foreground`}>
              <Phone className="size-4" aria-hidden="true" />
              Call {cafe.phone}
            </a>
            <a href={chatHref} target="_blank" rel="noopener noreferrer" className={`${btn} bg-success text-success-foreground`}>
              <MessageCircle className="size-4" aria-hidden="true" />
              WhatsApp
            </a>
            <a href={cafe.mapsUrl} target="_blank" rel="noopener noreferrer" className={`${btn} border-2 border-primary text-primary`}>
              <Navigation className="size-4" aria-hidden="true" />
              Directions
            </a>
          </div>
        </div>

        <Reveal className="relative min-h-80 overflow-hidden rounded-2xl bg-card shadow-card lg:min-h-full">
          {/* Shown until (or if) the embedded map loads. */}
          <div aria-hidden="true" className="absolute inset-0 grid place-items-center">
            <div className="checker absolute inset-0 opacity-[0.06] [--checker:20px]" />
            <MapPin className="relative size-12 text-primary" />
          </div>
          <iframe
            title="Map: Gluttons Garage on Dr NTR Beach Road, Visakhapatnam"
            src={cafe.mapsEmbed}
            loading="lazy"
            referrerPolicy="no-referrer-when-downgrade"
            className="absolute inset-0 size-full border-0"
          />
        </Reveal>
      </Container>
    </section>
  );
}
