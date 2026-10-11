import { ArrowUpRight } from "lucide-react";
import { cn } from "cn";
import { cafe } from "@/data/cafe";
import { imageBySlug } from "@/lib/images";
import { Container } from "./primitives/Container";
import { Picture } from "./primitives/Picture";
import { RevealItem } from "./primitives/Reveal";
import { SectionHeading } from "./primitives/SectionHeading";

/**
 * Bento layout: the same spans tile a 2-column grid (mobile) and a 4-column grid (desktop)
 * with no gaps, so the section always ends flush.
 */
const shots: { slug: string; span: string; sizes: string }[] = [
  { slug: "dessert-counter", span: "col-span-2 row-span-2", sizes: "(min-width: 1024px) 50vw, 100vw" },
  { slug: "vanilla-milkshake", span: "row-span-2", sizes: "(min-width: 1024px) 25vw, 50vw" },
  { slug: "chettinad-chicken-tenders", span: "row-span-2", sizes: "(min-width: 1024px) 25vw, 50vw" },
  { slug: "storefront-night", span: "col-span-2", sizes: "(min-width: 1024px) 50vw, 100vw" },
  { slug: "pasta-bolognese-pappardelle", span: "", sizes: "(min-width: 1024px) 25vw, 50vw" },
  { slug: "crumb-fried-devilled-eggs", span: "", sizes: "(min-width: 1024px) 25vw, 50vw" },
  { slug: "bbq-chicken-pizza-and-fish-fingers", span: "col-span-2", sizes: "(min-width: 1024px) 50vw, 100vw" },
  { slug: "grilled-quesadilla-and-chicken-salad", span: "col-span-2", sizes: "(min-width: 1024px) 50vw, 100vw" },
];

export function Gallery() {
  return (
    <section aria-labelledby="gallery-title" className="py-16 lg:py-24">
      <Container>
        <div className="flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
          <SectionHeading id="gallery-title" eyebrow="Snapshots" title="From the garage floor" />
          <a
            href={cafe.instagram}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex h-11 shrink-0 items-center gap-2 self-start rounded-full border-2 border-primary px-5 font-bold text-primary transition-colors hover:bg-primary hover:text-primary-foreground sm:self-auto"
          >
            More on Instagram
            <ArrowUpRight className="size-4" aria-hidden="true" />
          </a>
        </div>
        <ul className="mt-10 grid auto-rows-[9.5rem] grid-cols-2 gap-3 sm:auto-rows-[13rem] sm:gap-4 lg:grid-cols-4 lg:auto-rows-[15rem]">
          {shots.map(({ slug, span, sizes }, i) => (
            <RevealItem key={slug} index={i % 4} className={cn("overflow-hidden rounded-xl bg-secondary", span)}>
              <Picture
                img={imageBySlug(slug)}
                sizes={sizes}
                className="size-full object-cover transition-transform duration-500 hover:scale-[1.04]"
              />
            </RevealItem>
          ))}
        </ul>
      </Container>
    </section>
  );
}
