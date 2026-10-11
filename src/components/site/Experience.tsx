import { Armchair, BookOpen, Cigarette, PartyPopper, Sparkles, ToyBrick, type LucideIcon } from "lucide-react";
import { cafe } from "@/data/cafe";
import { imageBySlug } from "@/lib/images";
import { Container } from "./primitives/Container";
import { Picture } from "./primitives/Picture";
import { Reveal, RevealItem } from "./primitives/Reveal";
import { SectionHeading } from "./primitives/SectionHeading";

const icons: Record<string, LucideIcon> = {
  "Indoor & outdoor seating": Armchair,
  "Kids' play area": ToyBrick,
  "Book corner": BookOpen,
  "Party area": PartyPopper,
  "Smoke zone": Cigarette,
};

const mural = imageBySlug("logo-mural");
const floor = imageBySlug("dining-room-checkerboard-floor");
const storefront = imageBySlug("storefront-daytime");

export function Experience() {
  return (
    <section id="about" aria-labelledby="about-title" className="scroll-mt-20 py-16 lg:py-28">
      <Container className="grid items-center gap-12 lg:grid-cols-2 lg:gap-16">
        <Reveal className="relative order-last grid grid-cols-5 grid-rows-[auto_auto] gap-3 sm:gap-4 lg:order-first">
          <div className="col-span-3 row-span-2 overflow-hidden rounded-2xl shadow-card">
            <Picture img={mural} sizes="(min-width: 1024px) 30vw, 60vw" className="size-full object-cover" />
          </div>
          <div className="col-span-2 overflow-hidden rounded-2xl shadow-card">
            <Picture img={storefront} sizes="(min-width: 1024px) 20vw, 40vw" className="aspect-[3/4] size-full object-cover" />
          </div>
          <div className="col-span-2 overflow-hidden rounded-2xl shadow-card">
            <Picture img={floor} sizes="(min-width: 1024px) 20vw, 40vw" className="aspect-square size-full object-cover" />
          </div>
          <div aria-hidden="true" className="checker absolute -bottom-3 -left-3 -z-10 size-28 rounded-xl opacity-90 [--checker:10px] sm:-bottom-6 sm:-left-6" />
        </Reveal>

        <div>
          <SectionHeading
            id="about-title"
            eyebrow="The garage"
            title={
              <>
                Fusion <span className="italic">happens</span> here
              </>
            }
            lede="Bicycle-wheel lamps, a black-and-white gear mural, rust velvet tub chairs and that checkerboard floor. Come for breakfast after a beach walk, stay for coffee, come back for open-mic night."
          />
          <ul className="mt-8 grid gap-3 sm:grid-cols-2">
            {cafe.amenities.map((a, i) => {
              const Icon = icons[a] ?? Sparkles;
              return (
                <RevealItem key={a} index={i} className="flex items-center gap-3 rounded-xl border border-border bg-card px-4 py-3">
                  <span className="grid size-10 shrink-0 place-items-center rounded-full bg-primary text-primary-foreground">
                    <Icon className="size-5" aria-hidden="true" />
                  </span>
                  <span className="font-bold">{a}</span>
                </RevealItem>
              );
            })}
          </ul>
        </div>
      </Container>
    </section>
  );
}
