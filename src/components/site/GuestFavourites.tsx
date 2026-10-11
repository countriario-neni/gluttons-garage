import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { items } from "@/data/menu";
import { guestFavourites } from "@/lib/menu";
import { DishCard } from "./DishCard";
import { Container } from "./primitives/Container";
import { Rail } from "./primitives/Rail";
import { RevealItem } from "./primitives/Reveal";
import { SectionHeading } from "./primitives/SectionHeading";

const favourites = guestFavourites(items);

export function GuestFavourites() {
  return (
    <section aria-labelledby="favourites-title" className="py-16 lg:py-24">
      <Container>
        <Rail
          label="Guest favourites"
          heading={
            <SectionHeading
              id="favourites-title"
              eyebrow="From the kitchen"
              title="Guest favourites"
              lede="The bestsellers regulars come back for, and a few plates straight from our kitchen camera roll."
            />
          }
        >
          {favourites.map((item, i) => (
            <RevealItem key={item.id} index={i % 4} className="w-[78%] shrink-0 snap-start sm:w-[calc(50%-0.5rem)] lg:w-[calc(25%-1.125rem)]">
              <DishCard item={item} />
            </RevealItem>
          ))}
        </Rail>
        <Link
          href="/menu/"
          className="mt-6 inline-flex h-11 items-center gap-2 font-bold text-primary underline decoration-orange decoration-2 underline-offset-[6px]"
        >
          Browse all {items.length} dishes
          <ArrowRight className="size-4" aria-hidden="true" />
        </Link>
      </Container>
    </section>
  );
}
