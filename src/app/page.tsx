import { SiteShell } from "@/components/site/SiteShell";
import { Experience } from "@/components/site/Experience";
import { Gallery } from "@/components/site/Gallery";
import { GuestFavourites } from "@/components/site/GuestFavourites";
import { Hero } from "@/components/site/Hero";
import { Highlights } from "@/components/site/Highlights";
import { Checkerband } from "@/components/site/primitives/Checkerband";
import { Reviews } from "@/components/site/Reviews";
import { Visit } from "@/components/site/Visit";

export default function Home() {
  return (
    <SiteShell>
      <Hero />
      <Checkerband />
      <GuestFavourites />
      <Highlights />
      <Experience />
      <Reviews />
      <Gallery />
      <Visit />
    </SiteShell>
  );
}
