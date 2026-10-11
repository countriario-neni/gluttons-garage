"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { Menu as MenuIcon, Phone } from "lucide-react";
import { cn } from "cn";
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { cafe } from "@/data/cafe";
import { callHref, navLinks, orderHref } from "./links";
import { OpenBadge } from "./OpenBadge";
import { Wordmark } from "./Wordmark";

/** Fixed header. Transparent over the home hero, solid cream once scrolled or on other pages. */
export function SiteHeader() {
  const pathname = usePathname();
  const overHero = pathname === "/";
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const solid = !overHero || scrolled;

  return (
    <header
      className={cn(
        "fixed inset-x-0 top-0 z-40 transition-[background-color,box-shadow,color] duration-300",
        solid ? "bg-background/95 text-foreground shadow-card backdrop-blur" : "bg-transparent text-cream",
      )}
    >
      <div className="mx-auto flex h-[4.5rem] w-full max-w-7xl items-center gap-4 px-4 sm:px-6 lg:px-8">
        <Link href="/" aria-label="Gluttons Garage, home" className="rounded-md">
          <Wordmark tone={solid ? "maroon" : "cream"} className="text-[1.45rem] sm:text-[1.6rem]" />
        </Link>

        <OpenBadge className="hidden lg:inline-flex" />
        <OpenBadge compact className="lg:hidden" />

        <nav aria-label="Main" className="ml-auto hidden md:block">
          <ul className="flex items-center gap-1">
            {navLinks.map((l) => (
              <li key={l.href}>
                <Link
                  href={l.href}
                  aria-current={pathname === l.href ? "page" : undefined}
                  className="inline-flex h-11 items-center rounded-full px-4 font-bold underline-offset-[6px] decoration-2 decoration-orange hover:underline aria-[current=page]:underline"
                >
                  {l.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        <a
          href={orderHref}
          className="ml-auto hidden h-11 items-center rounded-full bg-accent px-5 font-bold text-accent-foreground shadow-card transition-transform hover:-translate-y-0.5 sm:inline-flex md:ml-2"
        >
          Order now
        </a>

        <Sheet open={open} onOpenChange={setOpen}>
          <SheetTrigger
            aria-label="Open menu"
            className="ml-auto grid size-11 place-items-center rounded-full sm:ml-0 md:hidden"
          >
            <MenuIcon className="size-6" aria-hidden="true" />
          </SheetTrigger>
          <SheetContent side="right" className="w-[85%] max-w-sm gap-0 bg-background p-0">
            <div className="flex h-[4.5rem] items-center border-b px-5">
              <SheetTitle className="sr-only">Menu</SheetTitle>
              <Wordmark className="text-[1.45rem]" />
            </div>
            <nav aria-label="Mobile" className="flex flex-col gap-1 p-5">
              {navLinks.map((l) => (
                <Link
                  key={l.href}
                  href={l.href}
                  onClick={() => setOpen(false)}
                  className="flex h-14 items-center border-b border-border font-[family-name:var(--font-display)] text-2xl font-bold text-primary"
                >
                  {l.label}
                </Link>
              ))}
            </nav>
            <div className="mt-auto flex flex-col gap-3 p-5">
              <OpenBadge className="self-start" />
              <a
                href={orderHref}
                className="inline-flex h-12 items-center justify-center rounded-full bg-accent font-bold text-accent-foreground"
              >
                Order now
              </a>
              <a
                href={callHref}
                className="inline-flex h-12 items-center justify-center gap-2 rounded-full border border-primary font-bold text-primary"
              >
                <Phone className="size-4" aria-hidden="true" />
                Call {cafe.phone}
              </a>
            </div>
          </SheetContent>
        </Sheet>
      </div>
    </header>
  );
}
