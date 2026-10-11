import { ArrowUpRight } from "lucide-react";
import { cn } from "cn";
import type { ReactNode } from "react";
import { cafe } from "@/data/cafe";
import { Container } from "./primitives/Container";
import { RevealItem } from "./primitives/Reveal";
import { SectionHeading } from "./primitives/SectionHeading";

/** Layered tiramisu slice with cocoa dusting and a coffee bean. */
function TiramisuArt() {
  return (
    <svg viewBox="0 0 240 160" aria-hidden="true" className="h-full w-full">
      <ellipse cx="120" cy="138" rx="92" ry="12" className="fill-ink/25" />
      <g>
        <path d="M44 66 L196 66 L196 128 Q120 140 44 128 Z" className="fill-cream-light" />
        <rect x="44" y="76" width="152" height="14" className="fill-timber" />
        <rect x="44" y="104" width="152" height="12" className="fill-timber" />
        <path d="M44 128 Q120 140 196 128 L196 132 Q120 144 44 132 Z" className="fill-rust" />
        <path d="M40 58 Q120 46 200 58 L200 68 L40 68 Z" className="fill-rust" />
        {[60, 78, 96, 114, 132, 150, 168, 186, 70, 104, 140, 176].map((x, i) => (
          <circle key={i} cx={x} cy={i < 8 ? 56 : 51} r={i % 3 === 0 ? 2.4 : 1.6} className="fill-ink/60" />
        ))}
      </g>
      <g transform="translate(176 22) rotate(25)">
        <ellipse cx="0" cy="0" rx="13" ry="17" className="fill-ink" />
        <path d="M0 -15 Q-5 0 0 15" fill="none" strokeWidth="2.5" className="stroke-rust" />
      </g>
      <g className="fill-orange">
        <path d="M36 24 l3 7 7 3 -7 3 -3 7 -3 -7 -7 -3 7 -3z" />
        <path d="M214 96 l2 5 5 2 -5 2 -2 5 -2 -5 -5 -2 5 -2z" />
      </g>
    </svg>
  );
}

/** Whole mango with stem and leaf, plus a "hedgehog" cut cheek. */
function MangoArt() {
  return (
    <svg viewBox="0 0 240 160" aria-hidden="true" className="h-full w-full">
      <ellipse cx="120" cy="144" rx="92" ry="9" className="fill-ink/25" />
      <path
        d="M58 52 C 72 24, 136 20, 156 56 C 174 88, 158 130, 116 138 C 76 145, 46 122, 44 94 C 43 78, 48 64, 58 52 Z"
        className="fill-orange stroke-ink"
        strokeWidth="3"
      />
      <path d="M128 122 C 146 116, 156 100, 156 84 C 160 104, 150 126, 128 122 Z" className="fill-rust/50" />
      <path d="M68 66 C 74 52, 88 44, 102 44" fill="none" strokeWidth="6" strokeLinecap="round" className="stroke-cream-light/70" />
      <path d="M100 30 C 98 22, 102 14, 110 10" fill="none" strokeWidth="4" strokeLinecap="round" className="stroke-timber" />
      <path d="M108 14 C 124 0, 152 4, 160 16 C 140 26, 120 26, 108 14 Z" className="fill-cream-light" />
      <path d="M112 15 C 128 14, 144 15, 156 16" fill="none" strokeWidth="1.5" className="stroke-leaf" />
      <g transform="translate(162 66)">
        <path d="M0 4 C 26 -8, 62 4, 62 34 C 62 64, 8 70, 2 40 Z" className="fill-rust stroke-ink" strokeWidth="3" />
        {[0, 1, 2].map((r) =>
          [0, 1, 2].map((c) => <rect key={`${r}${c}`} x={10 + c * 15} y={10 + r * 15} width="12" height="12" rx="3" className="fill-orange" />),
        )}
      </g>
      <g className="fill-cream-light">
        <path d="M30 30 l3 7 7 3 -7 3 -3 7 -3 -7 -7 -3 7 -3z" />
        <path d="M206 30 l2 5 5 2 -5 2 -2 5 -2 -5 -5 -2 5 -2z" />
      </g>
    </svg>
  );
}

/** Mic on a stand under a spotlight, with music notes: open mics, stand-up, gigs. */
function EventsArt() {
  return (
    <svg viewBox="0 0 240 160" aria-hidden="true" className="h-full w-full">
      <path d="M120 0 L60 150 L180 150 Z" className="fill-cream/10" />
      <ellipse cx="120" cy="148" rx="70" ry="8" className="fill-cream/15" />
      <rect x="117" y="70" width="6" height="76" rx="3" className="fill-kitchen-soft" />
      <path d="M96 146 h48" strokeWidth="6" strokeLinecap="round" className="stroke-kitchen-soft" />
      <rect x="104" y="22" width="32" height="50" rx="16" className="fill-orange" />
      {[34, 44, 54].map((y) => (
        <path key={y} d={`M108 ${y} h24`} strokeWidth="2" className="stroke-ink/40" />
      ))}
      <g className="fill-cream">
        <path d="M44 52 v34 a8 6 0 1 1 -4 -5 v-35 l22 -6 v6 z" />
        <path d="M190 40 v30 a7 5 0 1 1 -4 -4 v-32 l18 -5 v30 a7 5 0 1 1 -4 -4 v-20 z" />
      </g>
      <g className="fill-orange">
        <path d="M70 18 l3 7 7 3 -7 3 -3 7 -3 -7 -7 -3 7 -3z" />
        <path d="M176 104 l2 5 5 2 -5 2 -2 5 -2 -5 -5 -2 5 -2z" />
      </g>
    </svg>
  );
}

type Highlight = { title: string; kicker: string; copy: string; art: ReactNode; surface: string; muted: string };

const highlights: Highlight[] = [
  {
    title: "Tiramisu Fest",
    kicker: "Seasonal",
    copy: "Coffee-soaked layers and cocoa-dusted cream, made to share. Watch our Instagram for the next fest.",
    art: <TiramisuArt />,
    surface: "bg-maroon text-cream",
    muted: "text-cream/85",
  },
  {
    title: "Mango Mania",
    kicker: "Summer special",
    copy: "When mangoes are in season, they land in shakes, desserts and more. Follow along for the drop.",
    art: <MangoArt />,
    surface: "bg-leaf text-cream-light",
    muted: "text-cream-light/90",
  },
  {
    title: "Events at GG",
    kicker: "After dark",
    copy: "Music, stand-up, storytelling and art nights in the garage. Line-ups are posted on Instagram.",
    art: <EventsArt />,
    surface: "bg-ink text-cream",
    muted: "text-kitchen-soft",
  },
];

export function Highlights() {
  return (
    <section aria-labelledby="highlights-title" className="bg-secondary py-16 lg:py-24">
      <Container>
        <SectionHeading
          id="highlights-title"
          eyebrow="What's on"
          title="Fests, seasons & stage nights"
          lede="Something's always cooking at the garage. Here's what regulars look out for."
        />
        <ul className="mt-10 grid gap-5 md:grid-cols-3 lg:gap-6">
          {highlights.map((h, i) => (
            <RevealItem key={h.title} index={i}>
              <a
                href={cafe.instagram}
                target="_blank"
                rel="noopener noreferrer"
                className={cn(
                  "group flex h-full flex-col overflow-hidden rounded-2xl shadow-card transition-[transform,box-shadow] duration-200 hover:-translate-y-1 hover:shadow-lift",
                  h.surface,
                )}
              >
                <div className="aspect-[3/2] p-6 pb-0 transition-transform duration-500 group-hover:scale-[1.03]">{h.art}</div>
                <div className="flex flex-1 flex-col p-6 pt-4">
                  <p className={cn("text-xs font-bold tracking-[0.2em] uppercase", h.muted)}>{h.kicker}</p>
                  <h3 className="mt-2 text-3xl font-bold">{h.title}</h3>
                  <p className={cn("mt-3 leading-relaxed", h.muted)}>{h.copy}</p>
                  <span className="mt-6 inline-flex items-center gap-1.5 font-bold underline underline-offset-4">
                    {h.title} on Instagram
                    <ArrowUpRight className="size-4 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" aria-hidden="true" />
                  </span>
                </div>
              </a>
            </RevealItem>
          ))}
        </ul>
      </Container>
    </section>
  );
}
