import Link from "next/link";
import { Phone, SearchX, UtensilsCrossed } from "lucide-react";
import { Container } from "@/components/site/primitives/Container";
import { cafe } from "@/data/cafe";

export function OrderNotFound() {
  return (
    <Container className="max-w-lg py-12 sm:py-16">
      <div className="rounded-3xl border border-border bg-card p-6 text-center shadow-card sm:p-8">
        <SearchX className="mx-auto size-12 text-muted-foreground" aria-hidden="true" />
        <h1 className="mt-3 text-3xl font-bold text-primary">We couldn&apos;t find that order</h1>
        <p className="mt-2 text-muted-foreground">
          The link may be incomplete, or the order may have been placed on another device. Check the link in your WhatsApp message, or call us and we&apos;ll
          look it up.
        </p>
        <div className="mt-6 flex flex-col gap-2">
          <Link
            href="/order/"
            className="inline-flex h-12 items-center justify-center gap-2 rounded-full bg-accent font-bold text-accent-foreground shadow-card"
          >
            <UtensilsCrossed className="size-5" aria-hidden="true" /> Browse the menu
          </Link>
          <a
            href={`tel:${cafe.phoneE164}`}
            className="inline-flex h-12 items-center justify-center gap-2 rounded-full border-2 border-primary font-bold text-primary"
          >
            <Phone className="size-5" aria-hidden="true" /> Call {cafe.phone}
          </a>
        </div>
      </div>
    </Container>
  );
}
