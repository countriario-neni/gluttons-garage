"use client";

import Link from "next/link";
import { useState, type ReactNode } from "react";
import { cn } from "cn";
import { ArrowLeft, MessageCircle, Phone } from "lucide-react";
import { toast } from "sonner";
import { dateTime } from "@/components/track/format";
import { statusLabel } from "@/components/track/StatusStepper";
import { buttonVariants } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { formatINR } from "@/domain/money";
import { waLink } from "@/integrations/whatsapp/templates";
import { useLive, useStore } from "@/store";
import { dayLabel, PhoneReveal, TagBadge } from "./crm-format";
import { firstName, staffErrorCopy } from "./format";

const REASON = { earn: "Earned", redeem: "Redeemed", adjust: "Adjustment" } as const;

function Stat({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="rounded-xl bg-card p-4 shadow-card">
      <dt className="text-sm text-muted-foreground">{label}</dt>
      <dd className="mt-1 text-2xl font-extrabold tabular-nums">{value}</dd>
    </div>
  );
}

function Notes({ id, initial }: { id: string; initial: string }) {
  const store = useStore();
  const [text, setText] = useState(initial);
  const [saved, setSaved] = useState(initial);

  async function save() {
    if (text === saved) return;
    try {
      await store.updateCustomerNotes(id, text);
      setSaved(text);
      toast.success("Notes saved");
    } catch (e) {
      toast.error(staffErrorCopy(e));
    }
  }

  return (
    <div className="grid gap-2">
      <Label htmlFor="customer-notes" className="text-base font-bold">
        Notes
      </Label>
      <Textarea
        id="customer-notes"
        value={text}
        onChange={(e) => setText(e.target.value)}
        onBlur={() => void save()}
        maxLength={500}
        rows={4}
        placeholder="Allergies, favourite table, anything the team should know. Saves when you click away."
        className="text-base"
      />
    </div>
  );
}

export function CustomerProfile({ id }: { id: string }) {
  const { data, loading } = useLive("orders", (s) => s.getCustomer(id));

  const back = (
    <Link href="/staff/customers/" prefetch={false} className="inline-flex min-h-11 items-center gap-2 font-bold underline-offset-4 hover:underline">
      <ArrowLeft className="size-5" aria-hidden="true" /> All customers
    </Link>
  );

  if (!data) {
    return (
      <div className="grid gap-3 px-4 py-5 sm:px-6">
        {back}
        <p role="status" className="text-lg text-muted-foreground">
          {loading ? "Loading customer…" : "Customer not found."}
        </p>
      </div>
    );
  }

  const { stats, orders, ledger } = data;
  const orderCode = new Map(orders.map((o) => [o.id, o.code]));
  const hello = `Hi ${firstName(stats.name)}! `;

  return (
    <div className="grid gap-6 px-4 py-5 sm:px-6">
      {back}

      <header className="flex flex-wrap items-start gap-x-6 gap-y-3">
        <div className="min-w-0">
          <h1 className="font-sans text-3xl font-extrabold tracking-tight">{stats.name}</h1>
          <div className="flex flex-wrap items-center gap-x-3 text-lg">
            <PhoneReveal phone={stats.phone} />
            <span className="flex flex-wrap gap-1">
              {stats.tags.map((t) => (
                <TagBadge key={t} tag={t} />
              ))}
              {stats.tags.length === 0 && <span className="text-sm text-muted-foreground">No tags yet</span>}
            </span>
          </div>
        </div>
        <div className="ml-auto flex flex-wrap gap-2">
          <a
            href={waLink(`91${stats.phone}`, hello)}
            target="_blank"
            rel="noopener noreferrer"
            className={cn(buttonVariants({ variant: "outline" }), "px-4 text-base")}
          >
            <MessageCircle className="size-4" aria-hidden="true" /> WhatsApp
          </a>
          <a href={`tel:+91${stats.phone}`} className={cn(buttonVariants({ variant: "outline" }), "px-4 text-base")}>
            <Phone className="size-4" aria-hidden="true" /> Call
          </a>
        </div>
      </header>

      <dl className="grid grid-cols-2 gap-3 lg:grid-cols-4" aria-label="Customer stats">
        <Stat label="Orders" value={stats.orders} />
        <Stat label="Total spend" value={formatINR(stats.totalSpend)} />
        <Stat label="Average bill" value={formatINR(stats.avgBill)} />
        <Stat label="Loyalty points" value={stats.points} />
        <Stat label="Last order" value={<span className="text-xl">{stats.lastOrderAt ? dayLabel(stats.lastOrderAt) : "Never"}</span>} />
        <Stat label="Customer since" value={<span className="text-xl">{dayLabel(stats.createdAt)}</span>} />
        <Stat label="Marketing" value={<span className="text-xl">{stats.marketingOptIn ? "Opted in" : "Not opted in"}</span>} />
      </dl>

      <section aria-labelledby="fav-h" className="grid gap-2">
        <h2 id="fav-h" className="text-xl font-bold">
          Favourites
        </h2>
        {stats.favourites.length ? (
          <ul className="flex flex-wrap gap-2">
            {stats.favourites.map((f) => (
              <li key={f} className="rounded-full bg-muted px-3 py-1.5 text-base font-medium">
                {f}
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-muted-foreground">No orders yet.</p>
        )}
      </section>

      <section aria-labelledby="orders-h" className="grid gap-2">
        <h2 id="orders-h" className="text-xl font-bold">
          Order history
        </h2>
        <div className="overflow-hidden rounded-xl bg-card shadow-card">
          <Table aria-label="Order history">
            <TableHeader>
              <TableRow>
                <TableHead className="h-12 px-4 font-bold">Order</TableHead>
                <TableHead className="h-12 px-4 font-bold">Date</TableHead>
                <TableHead className="hidden h-12 px-4 font-bold sm:table-cell">Mode</TableHead>
                <TableHead className="h-12 px-4 text-right font-bold">Total</TableHead>
                <TableHead className="h-12 px-4 font-bold">Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {orders.map((o) => (
                <TableRow key={o.id} data-testid="history-row">
                  <TableCell className="px-4">
                    <Link href={`/track/?id=${encodeURIComponent(o.id)}`} prefetch={false} className="inline-flex min-h-11 items-center font-bold underline underline-offset-4">
                      {o.code}
                    </Link>
                  </TableCell>
                  <TableCell className="px-4 text-base whitespace-normal">{dateTime(o.createdAt)}</TableCell>
                  <TableCell className="hidden px-4 text-base sm:table-cell">{o.mode === "dine_in" ? "Dine-in" : "Takeaway"}</TableCell>
                  <TableCell className="px-4 text-right text-base tabular-nums">{formatINR(o.bill.total)}</TableCell>
                  <TableCell className="px-4 text-base">{statusLabel(o.status)}</TableCell>
                </TableRow>
              ))}
              {orders.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="px-4 py-8 text-center text-muted-foreground">
                    No orders yet.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </section>

      <section aria-labelledby="ledger-h" className="grid gap-2">
        <h2 id="ledger-h" className="flex items-baseline gap-3 text-xl font-bold">
          Loyalty
          <span className="text-base font-normal text-muted-foreground">
            Balance <strong data-testid="loyalty-balance" className="text-lg text-foreground tabular-nums">{stats.points}</strong> pts
          </span>
        </h2>
        <div className="overflow-hidden rounded-xl bg-card shadow-card">
          <Table aria-label="Loyalty ledger">
            <TableHeader>
              <TableRow>
                <TableHead className="h-12 px-4 font-bold">Date</TableHead>
                <TableHead className="h-12 px-4 font-bold">Entry</TableHead>
                <TableHead className="h-12 px-4 font-bold">Order</TableHead>
                <TableHead className="h-12 px-4 text-right font-bold">Points</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {ledger.map((l) => (
                <TableRow key={l.id} data-testid="ledger-row">
                  <TableCell className="px-4 text-base whitespace-normal">{dateTime(l.createdAt)}</TableCell>
                  <TableCell className="px-4 text-base">{REASON[l.reason]}</TableCell>
                  <TableCell className="px-4 text-base">{(l.orderId && orderCode.get(l.orderId)) || "—"}</TableCell>
                  <TableCell className="px-4 text-right text-base font-bold tabular-nums">{l.points > 0 ? `+${l.points}` : l.points}</TableCell>
                </TableRow>
              ))}
              {ledger.length === 0 && (
                <TableRow>
                  <TableCell colSpan={4} className="px-4 py-8 text-center text-muted-foreground">
                    No points yet. They are earned when an order is completed.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </section>

      <Notes id={stats.id} initial={stats.notes} />
    </div>
  );
}
