import Link from "next/link";
import { SiteShell } from "@/components/site/SiteShell";
import { Container } from "@/components/site/primitives/Container";
import { orderHref } from "@/components/site/links";
import { Gear } from "@/components/site/primitives/Gear";

export const metadata = { title: "Page not found" };

const btn = "inline-flex h-12 items-center justify-center rounded-full px-6 font-bold transition-transform hover:-translate-y-0.5";

export default function NotFound() {
  return (
    <SiteShell>
      <Container className="flex flex-col items-center gap-6 pt-40 pb-24 text-center">
        <Gear className="size-20 text-primary/30" strokeWidth={1.5} />
        <p className="font-[family-name:var(--font-wordmark)] text-sm tracking-[0.12em] text-primary uppercase">Error 404</p>
        <h1 className="font-display text-4xl font-bold text-balance sm:text-5xl">This page took a wrong turn</h1>
        <p className="max-w-md text-lg text-muted-foreground text-pretty">
          The page you were after isn&apos;t in the garage. Head back to the menu, or order something good.
        </p>
        <div className="flex flex-wrap justify-center gap-3">
          <Link href="/" className={`${btn} bg-primary text-primary-foreground`}>Home</Link>
          <Link href="/menu/" className={`${btn} border border-border bg-card`}>Menu</Link>
          {/* Plain href: the order flow is a separate static route; avoid prefetching it. */}
          <a href={orderHref} className={`${btn} bg-accent text-accent-foreground`}>Order</a>
        </div>
      </Container>
    </SiteShell>
  );
}
