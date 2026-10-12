import { SiteShell } from "@/components/site/SiteShell";
import type { Metadata } from "next";
import { MenuBrowser } from "@/components/site/MenuBrowser";
import { Checkerband } from "@/components/site/primitives/Checkerband";
import { Container } from "@/components/site/primitives/Container";
import { Gear } from "@/components/site/primitives/Gear";
import { categories, items } from "@/data/menu";

export const metadata: Metadata = {
  title: "Menu, Beach Road Vizag",
  description: `The full Gluttons Garage menu: ${items.length} dishes across ${categories.length} sections, from healthy breakfasts and crepes to pizzas, soups and desserts.`,
};

export default function MenuPage() {
  return (
    <SiteShell>
      <section className="relative overflow-hidden bg-primary pt-[4.5rem] text-primary-foreground">
        <Gear className="animate-gear pointer-events-none absolute -top-20 -right-20 size-80 text-cream/10" strokeWidth={1.5} />
        <Container className="relative py-12 lg:py-16">
          <p className="text-xs font-bold tracking-[0.2em] text-orange uppercase">Gluttons Garage · Beach Road</p>
          <h1 className="mt-3 text-5xl font-bold sm:text-6xl">The menu</h1>
          <p className="mt-4 max-w-xl text-lg text-cream/90">
            {items.length} dishes across {categories.length} sections. Prices in rupees; calories where our kitchen has measured them.
          </p>
        </Container>
        <Checkerband />
      </section>
      <MenuBrowser />
    </SiteShell>
  );
}
