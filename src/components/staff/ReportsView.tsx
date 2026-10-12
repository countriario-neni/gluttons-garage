"use client";

import { useMemo, useState } from "react";
import { Download, Minus, TrendingDown, TrendingUp } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatINR } from "@/domain/money";
import { dayKey, deltaPercent, previousRange, summarize, toCsv, type Range } from "@/domain/reports";
import { useLive } from "@/store";
import { OrdersByHourChart, RevenueByDayChart, StackedBar } from "./ReportCharts";

type Preset = "today" | "7d" | "30d" | "custom";
const PRESETS: { key: Preset; label: string }[] = [
  { key: "today", label: "Today" },
  { key: "7d", label: "7 days" },
  { key: "30d", label: "30 days" },
  { key: "custom", label: "Custom" },
];

const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
const endOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999);
const parseDay = (s: string) => {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, m - 1, d);
};

function rangeFor(preset: Exclude<Preset, "custom">, now: Date): Range {
  const back = preset === "today" ? 0 : preset === "7d" ? 6 : 29;
  return { from: new Date(now.getFullYear(), now.getMonth(), now.getDate() - back), to: endOfDay(now) };
}

/** Takeaway-style title: "Dine-in is 77% of orders", or the neutral name when there is no data. */
function leadTitle(parts: [string, number][], suffix: string, noun: string): string {
  const total = parts.reduce((s, p) => s + p[1], 0);
  if (!total) return `No ${noun} in this period yet`;
  const [label, value] = parts.reduce((m, p) => (p[1] > m[1] ? p : m));
  return `${label} is ${Math.round((value / total) * 100)}% ${suffix}`;
}

function Delta({ now, before }: { now: number; before: number }) {
  const pct = deltaPercent(now, before);
  if (pct === null) return <p className="mt-1 text-sm text-muted-foreground">No earlier period to compare</p>;
  const Icon = pct > 0 ? TrendingUp : pct < 0 ? TrendingDown : Minus;
  const word = pct > 0 ? "up" : pct < 0 ? "down" : "unchanged";
  return (
    <p className="mt-1 flex items-center gap-1.5 text-sm text-muted-foreground">
      <Icon className="size-4 text-foreground" aria-hidden="true" />
      <span className="font-bold text-foreground">
        <span className="sr-only">{word} </span>
        {Math.abs(pct)}%
      </span>
      vs previous period
    </p>
  );
}

function Kpi({ label, value, now, before, id }: { label: string; value: string; now: number; before: number; id: string }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-4 sm:p-5">
      <p className="text-sm font-bold tracking-wide text-muted-foreground uppercase">{label}</p>
      <p className="mt-1 font-display text-3xl font-bold tabular-nums" data-testid={`kpi-${id}`}>
        {value}
      </p>
      <Delta now={now} before={before} />
    </div>
  );
}

export function ReportsView() {
  const { data: orders, loading, error } = useLive("orders", (s) => s.listOrders({}));
  const today = useMemo(() => new Date(), []);
  const [preset, setPreset] = useState<Preset>("7d");
  const [fromStr, setFromStr] = useState(dayKey(new Date(today.getFullYear(), today.getMonth(), today.getDate() - 6)));
  const [toStr, setToStr] = useState(dayKey(today));

  const customInvalid = preset === "custom" && (!fromStr || !toStr || fromStr > toStr);
  const range: Range =
    preset === "custom" ? (customInvalid ? rangeFor("7d", today) : { from: startOfDay(parseDay(fromStr)), to: endOfDay(parseDay(toStr)) }) : rangeFor(preset, today);

  const all = orders ?? [];
  const cur = summarize(all, range);
  const prev = summarize(all, previousRange(range));

  const exportCsv = () => {
    const inRange = all.filter((o) => {
      const t = new Date(o.createdAt).getTime();
      return t >= range.from.getTime() && t <= range.to.getTime();
    });
    const url = URL.createObjectURL(new Blob([toCsv(inRange)], { type: "text/csv;charset=utf-8" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `gluttons-garage-orders-${dayKey(new Date())}.csv`;
    document.body.append(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    toast.success(`Exported ${inRange.length} ${inRange.length === 1 ? "order" : "orders"}`);
  };

  if (error) return <p role="alert">Couldn&apos;t load orders. Please refresh.</p>;
  const shown = (r: Range) => `${r.from.toLocaleDateString("en-IN", { day: "numeric", month: "short" })} to ${r.to.toLocaleDateString("en-IN", { day: "numeric", month: "short" })}`;

  return (
    <div className="grid gap-6" aria-busy={loading}>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div role="group" aria-label="Report period" className="flex flex-wrap gap-2">
          {PRESETS.map((p) => (
            <Button
              key={p.key}
              type="button"
              variant={preset === p.key ? "default" : "outline"}
              aria-pressed={preset === p.key}
              className="h-11 px-4 text-base"
              onClick={() => setPreset(p.key)}
            >
              {p.label}
            </Button>
          ))}
        </div>
        <Button type="button" variant="outline" className="h-11 px-4 text-base" onClick={exportCsv} disabled={loading}>
          <Download className="size-5" aria-hidden="true" /> Export CSV
        </Button>
      </div>

      {preset === "custom" && (
        <div className="flex flex-wrap items-end gap-4">
          <div className="grid gap-1.5">
            <Label htmlFor="rep-from">From</Label>
            <Input id="rep-from" type="date" className="h-11 w-44 text-base" value={fromStr} max={toStr || undefined} onChange={(e) => setFromStr(e.target.value)} aria-invalid={customInvalid} />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="rep-to">To</Label>
            <Input id="rep-to" type="date" className="h-11 w-44 text-base" value={toStr} min={fromStr || undefined} onChange={(e) => setToStr(e.target.value)} aria-invalid={customInvalid} />
          </div>
          {customInvalid && (
            <p role="alert" className="pb-2 text-destructive-foreground">
              Pick a start date on or before the end date.
            </p>
          )}
        </div>
      )}

      <p className="-mb-3 text-sm text-muted-foreground">
        {shown(range)}, compared with {shown(previousRange(range))}. Only completed, fully paid orders count as revenue.
      </p>

      <div className="grid gap-4 sm:grid-cols-3">
        <Kpi id="revenue" label="Revenue" value={formatINR(cur.revenue)} now={cur.revenue} before={prev.revenue} />
        <Kpi id="orders" label="Orders" value={String(cur.orders)} now={cur.orders} before={prev.orders} />
        <Kpi id="aov" label="Average order" value={formatINR(cur.aov)} now={cur.aov} before={prev.aov} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <RevenueByDayChart byDay={cur.byDay} />
        <OrdersByHourChart byHour={cur.byHour} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <StackedBar
          title={leadTitle([["Dine-in", cur.byMode.dine_in], ["Takeaway", cur.byMode.takeaway]], "of orders", "orders")}
          parts={[
            { label: "Dine-in", value: cur.byMode.dine_in },
            { label: "Takeaway", value: cur.byMode.takeaway },
          ]}
        />
        <StackedBar
          title={leadTitle([["Online", cur.byPayment.online], ["Cash at counter", cur.byPayment.cash], ["Split", cur.byPayment.split]], "of payments", "payments")}
          parts={[
            { label: "Online", value: cur.byPayment.online },
            { label: "Cash at counter", value: cur.byPayment.cash },
            { label: "Split (online + cash)", value: cur.byPayment.split },
          ]}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-[2fr_1fr]">
        <section aria-labelledby="top-items" className="rounded-2xl border border-border bg-card p-4 sm:p-5">
          <h2 id="top-items" className="mb-3 text-lg font-bold">
            {cur.topItems[0] ? `Top seller: ${cur.topItems[0].name}` : "Top items"}
          </h2>
          {cur.topItems.length === 0 ? (
            <p className="text-muted-foreground">No paid orders in this period.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-base">
                <thead className="text-sm text-muted-foreground">
                  <tr>
                    <th scope="col" className="py-2 pr-3 font-bold">Item</th>
                    <th scope="col" className="px-3 py-2 text-right font-bold">Qty</th>
                    <th scope="col" className="py-2 pl-3 text-right font-bold">Revenue</th>
                  </tr>
                </thead>
                <tbody>
                  {cur.topItems.slice(0, 8).map((i) => (
                    <tr key={i.name} className="border-t border-border">
                      <th scope="row" className="py-2 pr-3 font-normal">{i.name}</th>
                      <td className="px-3 py-2 text-right tabular-nums">{i.qty}</td>
                      <td className="py-2 pl-3 text-right tabular-nums">{formatINR(i.revenue)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <section aria-labelledby="discounts" className="rounded-2xl border border-border bg-card p-4 sm:p-5">
          <h2 id="discounts" className="mb-3 text-lg font-bold">Discounts given</h2>
          <dl className="grid gap-3">
            <div>
              <dt className="text-sm text-muted-foreground">Coupons</dt>
              <dd className="font-display text-2xl font-bold tabular-nums" data-testid="coupon-total">{formatINR(cur.couponDiscount)}</dd>
            </div>
            <div>
              <dt className="text-sm text-muted-foreground">Loyalty points redeemed</dt>
              <dd className="font-display text-2xl font-bold tabular-nums" data-testid="loyalty-total">{formatINR(cur.loyaltyDiscount)}</dd>
            </div>
          </dl>
        </section>
      </div>
    </div>
  );
}
