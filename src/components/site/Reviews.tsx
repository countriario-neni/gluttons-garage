import { ArrowUpRight, Info, Quote, Star } from "lucide-react";
import { cafe } from "@/data/cafe";
import { sampleReviews } from "@/integrations/reviews/sample";
import { Container } from "./primitives/Container";
import { Rail } from "./primitives/Rail";
import { RevealItem } from "./primitives/Reveal";
import { SectionHeading } from "./primitives/SectionHeading";

function Stars({ value }: { value: number }) {
  return (
    <span role="img" aria-label={`${value} out of 5 stars`} className="inline-flex gap-0.5">
      {Array.from({ length: 5 }, (_, i) => (
        <Star key={i} aria-hidden="true" className={i < Math.round(value) ? "size-4 fill-orange text-orange" : "size-4 text-line"} />
      ))}
    </span>
  );
}

export function Reviews() {
  return (
    <section id="reviews" aria-labelledby="reviews-title" className="scroll-mt-20 bg-secondary py-16 lg:py-24">
      <Container>
        <div className="mb-10 flex flex-col gap-6 rounded-2xl bg-card p-6 shadow-card sm:flex-row sm:items-center sm:justify-between sm:p-8">
          <div className="flex items-center gap-5">
            <p className="font-[family-name:var(--font-display)] text-6xl leading-none font-bold whitespace-nowrap text-primary">
              {cafe.rating.value}
              <Star className="ml-1 inline size-8 -translate-y-3 fill-orange text-orange" aria-hidden="true" />
            </p>
            <div>
              <p className="font-bold">
                {cafe.rating.value}★ on {cafe.rating.source}
              </p>
              <p className="text-sm text-muted-foreground">Rated by guests on Google Maps</p>
            </div>
          </div>
          <a
            href={cafe.mapsUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex h-12 items-center justify-center gap-2 rounded-full bg-primary px-6 font-bold text-primary-foreground transition-transform hover:-translate-y-0.5"
          >
            Read our reviews on Google
            <ArrowUpRight className="size-4" aria-hidden="true" />
          </a>
        </div>

        <Rail
          label="Sample reviews"
          heading={
            <div>
              <SectionHeading id="reviews-title" eyebrow="Word on the street" title="What guests say" />
              <p className="mt-4 inline-flex items-center gap-2 rounded-full border border-primary/30 bg-card px-3 py-1.5 text-sm text-muted-foreground">
                <Info className="size-4 text-primary" aria-hidden="true" />
                <strong className="text-primary">Sample reviews</strong>
                <span className="hidden sm:inline">· placeholders until real Google reviews are connected</span>
              </p>
            </div>
          }
        >
          {sampleReviews.map((r, i) => (
            <RevealItem key={r.id} index={i % 3} className="w-[85%] shrink-0 snap-start sm:w-[calc(50%-0.5rem)] lg:w-[calc(33.333%-1rem)]">
              <figure className="flex h-full flex-col rounded-2xl bg-card p-6 shadow-card">
                <Quote className="size-8 text-orange" aria-hidden="true" />
                <blockquote className="mt-3 flex-1 font-[family-name:var(--font-display)] text-xl leading-snug">“{r.text}”</blockquote>
                <figcaption className="mt-6 flex items-end justify-between gap-3 border-t border-border pt-4">
                  <span>
                    <span className="block font-bold">{r.name}</span>
                    <span className="block text-sm text-muted-foreground">Tried the {r.dish.replace(/\s*\(.*\)$/, "")}</span>
                  </span>
                  <Stars value={r.rating} />
                </figcaption>
              </figure>
            </RevealItem>
          ))}
        </Rail>
      </Container>
    </section>
  );
}
