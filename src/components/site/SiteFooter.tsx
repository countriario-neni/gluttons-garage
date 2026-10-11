import Link from "next/link";
import { Camera, MessageCircle, Phone, ThumbsUp } from "lucide-react";
import { cafe } from "@/data/cafe";
import { callHref, chatHref, navLinks } from "./links";
import { Checkerband } from "./primitives/Checkerband";
import { Container } from "./primitives/Container";
import { Gear } from "./primitives/Gear";
import { Wordmark } from "./Wordmark";

const colTitle = "font-sans text-xs font-bold tracking-[0.2em] text-orange uppercase";
const link = "inline-flex min-h-11 items-center gap-2 hover:underline underline-offset-4";

export function SiteFooter() {
  const socials = [
    { label: "Instagram", href: cafe.instagram, Icon: Camera },
    ...(cafe.facebook ? [{ label: "Facebook", href: cafe.facebook, Icon: ThumbsUp }] : []),
    { label: "WhatsApp", href: chatHref, Icon: MessageCircle },
  ];
  const delivery = [
    { label: "Swiggy", href: cafe.delivery.swiggy },
    { label: "Zomato", href: cafe.delivery.zomato },
  ].filter((d): d is { label: string; href: string } => Boolean(d.href));

  return (
    <footer className="relative overflow-hidden bg-ink text-cream">
      <Checkerband className="opacity-90" />
      <Gear className="pointer-events-none absolute top-10 -right-28 size-80 text-kitchen-raised" strokeWidth={1.5} />
      <Container className="relative grid gap-10 py-16 md:grid-cols-[1.4fr_1fr_1fr_1fr]">
        <div>
          <Wordmark tone="cream" className="text-[2.25rem]" />
          <p className="mt-5 max-w-xs text-kitchen-soft">{cafe.tagline.replaceAll("•", "·")}</p>
          <p className="mt-2 max-w-xs text-kitchen-soft">Fusion happens here, on Beach Road, Vizag.</p>
        </div>

        <div>
          <h2 className={colTitle}>Explore</h2>
          <ul className="mt-3">
            {navLinks.map((l) => (
              <li key={l.href}>
                <Link href={l.href} className={link}>
                  {l.label}
                </Link>
              </li>
            ))}
          </ul>
        </div>

        <div>
          <h2 className={colTitle}>Visit</h2>
          <address className="mt-3 max-w-56 text-kitchen-soft not-italic">{cafe.address}</address>
          <a href={callHref} className={link}>
            <Phone className="size-4" aria-hidden="true" />
            Call {cafe.phone}
          </a>
        </div>

        <div className="space-y-8">
          <div>
            <h2 className={colTitle}>Follow</h2>
            <ul className="mt-3">
              {socials.map(({ label, href, Icon }) => (
                <li key={label}>
                  <a href={href} target="_blank" rel="noopener noreferrer" className={link}>
                    <Icon className="size-4" aria-hidden="true" />
                    {label}
                  </a>
                </li>
              ))}
            </ul>
          </div>
          {delivery.length > 0 && (
            <div>
              <h2 className={colTitle}>Delivery</h2>
              <ul className="mt-3">
                {delivery.map((d) => (
                  <li key={d.label}>
                    <a href={d.href} target="_blank" rel="noopener noreferrer" className={link}>
                      Order on {d.label}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </Container>
      <Container className="relative flex flex-col gap-2 border-t border-kitchen-line py-6 text-sm text-kitchen-soft sm:flex-row sm:justify-between">
        <p>© {new Date().getFullYear()} {cafe.name}, Visakhapatnam.</p>
        <p>Demo build: sample reviews and demo ordering, no real payments.</p>
      </Container>
    </footer>
  );
}
