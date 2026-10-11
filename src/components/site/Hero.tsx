import { CalendarDays, Phone, Star } from "lucide-react";
import { cafe } from "@/data/cafe";
import { imageBySlug } from "@/lib/images";
import { bookHref, callHref, orderHref } from "./links";
import { Gear } from "./primitives/Gear";
import { Picture } from "./primitives/Picture";

const photo = imageBySlug("dining-room-gear-mural");

const btn = "inline-flex h-12 items-center justify-center gap-2 rounded-full px-4 font-bold sm:px-6 transition-transform hover:-translate-y-0.5";

export function Hero() {
  return (
    <section aria-labelledby="hero-title" className="relative isolate flex min-h-[100svh] items-end overflow-hidden bg-ink text-cream lg:min-h-[min(100svh,900px)]">
      <Picture
        img={photo}
        priority
        sizes="100vw"
        className="absolute inset-0 -z-20 size-full object-cover object-[50%_42%]"
      />
      {/* Scrim: keeps cream text above 4.5:1 over the photo's light mural. */}
      <div
        aria-hidden="true"
        className="absolute inset-0 -z-10 bg-[linear-gradient(to_top,var(--color-ink)_8%,color-mix(in_oklab,var(--color-ink)_78%,transparent)_45%,color-mix(in_oklab,var(--color-ink)_45%,transparent)_100%)] lg:bg-[linear-gradient(100deg,var(--color-ink)_10%,color-mix(in_oklab,var(--color-ink)_80%,transparent)_45%,color-mix(in_oklab,var(--color-ink)_25%,transparent)_100%)]"
      />
      <Gear className="animate-gear pointer-events-none absolute -top-24 -right-24 -z-10 hidden size-[28rem] text-cream/10 lg:block" strokeWidth={1} />

      <div className="mx-auto w-full max-w-7xl px-4 pt-32 pb-24 sm:px-6 sm:pb-14 lg:px-8 lg:pb-24">
        <div className="reveal max-w-3xl">
          <h1 id="hero-title">
            <span className="block font-[family-name:var(--font-wordmark)] text-base tracking-[0.08em] text-orange uppercase sm:text-xl">
              Gluttons Garage
            </span>
            <span className="mt-3 block text-[2.35rem] leading-[1.04] font-bold text-balance sm:text-6xl lg:text-[4.5rem]">
              Fusion food, speciality coffee <em className="text-orange not-italic">&amp;</em> desserts on Beach Road
            </span>
          </h1>
          <p className="mt-5 max-w-xl text-base leading-relaxed text-cream/90 sm:mt-6 sm:text-lg">
            A garage-themed hangout in Vizag: gear murals, a checkerboard floor and a kitchen that mixes everything from
            pancakes to peri peri. Open daily from 8 AM.
          </p>

          <div className="mt-7 grid grid-cols-2 gap-3 sm:mt-8 sm:flex sm:flex-wrap">
            <a href={orderHref} className={`${btn} col-span-2 bg-accent text-accent-foreground shadow-lift`}>
              Order now
            </a>
            <a href={bookHref} target="_blank" rel="noopener noreferrer" className={`${btn} border-2 border-cream/80 text-cream hover:bg-cream/10`}>
              <CalendarDays className="size-5" aria-hidden="true" />
              Book a table
            </a>
            <a href={callHref} className={`${btn} border-2 border-transparent text-cream underline-offset-4 hover:underline`}>
              <Phone className="size-5" aria-hidden="true" />
              Call us
            </a>
          </div>

          <p className="mt-10 hidden items-center gap-2 text-sm text-cream/85 sm:inline-flex">
            <Star className="size-4 fill-orange text-orange" aria-hidden="true" />
            <span>
              <strong className="text-cream">{cafe.rating.value}</strong> on {cafe.rating.source} · Dr NTR Beach Road, beside Aqua Sports Complex
            </span>
          </p>
        </div>
      </div>
    </section>
  );
}
