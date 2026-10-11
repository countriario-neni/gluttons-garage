"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useState, type ReactNode } from "react";
import { cn } from "cn";
import { MessageCircle, Phone, XCircle } from "lucide-react";
import { Checkerband } from "@/components/site/primitives/Checkerband";
import { Container } from "@/components/site/primitives/Container";
import { cafe } from "@/data/cafe";
import { orderShareText, waLink } from "@/integrations/whatsapp/templates";
import { StoreProvider, useLive } from "@/store";
import type { Order } from "@/store/DataStore";
import { whereLine } from "./format";
import { Invoice } from "./Invoice";
import { ItemisedBill } from "./ItemisedBill";
import { OrderNotFound } from "./NotFound";
import { PaymentSummary } from "./PaymentSummary";
import { StatusStepper, statusLabel } from "./StatusStepper";
import { TrackSkeleton } from "./TrackSkeleton";
import { WhatsAppPreview } from "./WhatsAppPreview";

export function TrackApp() {
  const id = useSearchParams().get("id");
  return (
    <StoreProvider>{id ? <TrackScreen id={id} /> : <OrderNotFound />}</StoreProvider>
  );
}

function Card({ title, children, className }: { title: string; children: ReactNode; className?: string }) {
  const heading = title.toLowerCase().replace(/\W+/g, "-");
  return (
    <section aria-labelledby={heading} className={cn("rounded-3xl border border-border bg-card p-5 shadow-card sm:p-6", className)}>
      <h2 id={heading} className="mb-4 text-xl font-bold text-primary">
        {title}
      </h2>
      {children}
    </section>
  );
}

const callCafe = (label: string, className: string) => (
  <a href={`tel:${cafe.phoneE164}`} className={className}>
    <Phone className="size-5" aria-hidden="true" /> {label}
  </a>
);

function TrackScreen({ id }: { id: string }) {
  const order = useLive("orders", (s) => s.getOrder(id));
  const messages = useLive("messages", (s) => s.listMessages({ orderId: id }));
  const status = order.data?.status;

  // Polite announcement when the status changes after the first load (adjusting state during render, no effect).
  const [seen, setSeen] = useState<string | undefined>(undefined);
  const [announcement, setAnnouncement] = useState("");
  if (status && status !== seen) {
    setSeen(status);
    if (seen !== undefined) setAnnouncement(`Your order is now ${statusLabel(status)}.`);
  }

  if (order.loading) return <TrackSkeleton />;
  if (!order.data) return <OrderNotFound />;
  const o = order.data;
  const closed = o.status === "rejected" || o.status === "cancelled";

  return (
    <Container className="max-w-5xl py-8 sm:py-12">
      <p role="status" aria-live="polite" className="sr-only">
        {announcement}
      </p>
      <Hero order={o} closed={closed} />

      <div className="mt-6 space-y-6">
        {closed ? (
          <section aria-labelledby="closed-heading" className="rounded-3xl border-2 border-destructive bg-destructive/5 p-5 sm:p-6">
            <h2 id="closed-heading" className="flex items-center gap-2 text-xl font-bold text-destructive">
              <XCircle className="size-6" aria-hidden="true" />
              {o.status === "rejected" ? "We couldn't take your order" : "This order was cancelled"}
            </h2>
            <p className="mt-2">
              {o.status === "rejected"
                ? "Sorry about that. We couldn't take your order this time. "
                : "Your order has been cancelled. "}
              Any payment or points used will be returned. Please call us and we&apos;ll sort it out.
            </p>
            {callCafe(
              "Call the café",
              "mt-4 inline-flex h-12 items-center justify-center gap-2 rounded-full bg-destructive px-6 font-bold text-destructive-foreground",
            )}
          </section>
        ) : (
          <Card title="Order progress">
            <StatusStepper order={o} />
          </Card>
        )}

        <div className="grid items-start gap-6 lg:grid-cols-2">
          <div className="space-y-6">
            <Card title="Payment">
              <PaymentSummary order={o} />
            </Card>
            <Card title="Your bill">
              <ItemisedBill order={o} />
            </Card>
          </div>
          <div className="space-y-6 lg:sticky lg:top-24">
            <WhatsAppPreview messages={messages.data ?? []} />
            <div className="flex flex-col gap-2 sm:flex-row">
              <a
                href={waLink(cafe.whatsapp, orderShareText(o))}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex h-12 flex-1 items-center justify-center gap-2 rounded-full bg-primary px-5 font-bold text-primary-foreground shadow-card"
              >
                <MessageCircle className="size-5" aria-hidden="true" /> Send order on WhatsApp
              </a>
              {callCafe("Call café", "inline-flex h-12 flex-1 items-center justify-center gap-2 rounded-full border-2 border-primary px-5 font-bold text-primary")}
            </div>
          </div>
        </div>

        <p className="text-center">
          <Link href="/order/" className="inline-flex min-h-11 items-center justify-center gap-2 font-bold text-primary underline underline-offset-4">
            Order more
          </Link>
        </p>
      </div>
      <Invoice order={o} />
    </Container>
  );
}

function Hero({ order, closed }: { order: Order; closed: boolean }) {
  return (
    <div className="overflow-hidden rounded-3xl border border-border bg-card shadow-card">
      <Checkerband />
      <div className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between sm:p-8">
        <div>
          <p className="text-xs font-bold tracking-[0.2em] text-primary uppercase">Your order</p>
          <h1 className="mt-1 text-5xl font-bold tracking-wide text-primary tabular-nums sm:text-6xl">{order.code}</h1>
          <p className="mt-2 text-lg">{whereLine(order)}</p>
        </div>
        <div className="sm:text-right">
          <p className="text-xs font-bold tracking-wide text-muted-foreground uppercase">Status</p>
          <p
            key={order.status}
            data-testid="order-status"
            className={cn(
              "animate-tick-pop mt-1 inline-block rounded-full px-5 py-2 text-xl font-bold",
              closed ? "bg-destructive text-destructive-foreground" : "bg-accent text-accent-foreground",
            )}
          >
            {statusLabel(order.status)}
          </p>
        </div>
      </div>
    </div>
  );
}
