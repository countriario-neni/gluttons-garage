"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { Area, AreaChart, Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { formatINR } from "@/domain/money";
import type { Summary } from "@/domain/reports";

type Tokens = { primary: string; second: string; text: string; grid: string };
const FALLBACK: Tokens = { primary: "currentColor", second: "currentColor", text: "currentColor", grid: "currentColor" };

/** Brand colours straight from the CSS tokens of the surrounding theme (recharts needs concrete colour strings). */
function useChartTokens() {
  const ref = useRef<HTMLDivElement>(null);
  const [tokens, setTokens] = useState<Tokens>(FALLBACK);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const css = getComputedStyle(el);
    const get = (name: string, fallback: string) => css.getPropertyValue(name).trim() || fallback;
    setTokens({
      primary: get("--primary", FALLBACK.primary),
      second: get("--chart-5", FALLBACK.second),
      text: get("--muted-foreground", FALLBACK.text),
      grid: get("--border", FALLBACK.grid),
    });
  }, []);
  return [ref, tokens] as const;
}

const compactINR = (n: number) => (n >= 1000 ? `₹${+(n / 1000).toFixed(1)}k` : `₹${n}`);
const hourLabel = (h: number) => `${h % 12 === 0 ? 12 : h % 12} ${h < 12 ? "AM" : "PM"}`;
const dayLabel = (iso: string) => new Date(`${iso}T00:00:00`).toLocaleDateString("en-IN", { day: "numeric", month: "short" });
const dayLong = (iso: string) => new Date(`${iso}T00:00:00`).toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short" });

function ChartCard({ title, summary, children, table }: { title: string; summary: string; children: ReactNode; table: ReactNode }) {
  return (
    <section aria-label={title} className="rounded-2xl border border-border bg-card p-4 sm:p-5">
      <h3 className="mb-4 text-lg font-bold">{title}</h3>
      <div role="img" aria-label={`${title}. ${summary}`} className="h-64 w-full sm:h-72">
        {children}
      </div>
      {table}
    </section>
  );
}

const tooltipStyle = {
  background: "var(--popover)",
  border: "1px solid var(--border)",
  borderRadius: 12,
  color: "var(--popover-foreground)",
};

export function RevenueByDayChart({ byDay }: { byDay: Summary["byDay"] }) {
  const [ref, t] = useChartTokens();
  const total = byDay.reduce((s, d) => s + d.revenue, 0);
  const best = byDay.reduce((m, d) => (d.revenue > m.revenue ? d : m), byDay[0] ?? { date: "", revenue: 0, orders: 0 });
  const title = total === 0 ? "No paid revenue in this period yet" : `Best day: ${dayLong(best.date)} with ${formatINR(best.revenue)}`;
  const summary = `Revenue by day, ${byDay.length} days, total ${formatINR(total)}.`;
  const single = byDay.length < 2;
  return (
    <div ref={ref}>
      <ChartCard
        title={title}
        summary={summary}
        table={
          <table className="sr-only">
            <caption>Revenue and orders by day</caption>
            <thead>
              <tr>
                <th>Day</th>
                <th>Revenue</th>
                <th>Orders</th>
              </tr>
            </thead>
            <tbody>
              {byDay.map((d) => (
                <tr key={d.date}>
                  <td>{dayLong(d.date)}</td>
                  <td>{formatINR(d.revenue)}</td>
                  <td>{d.orders}</td>
                </tr>
              ))}
            </tbody>
          </table>
        }
      >
        <ResponsiveContainer width="100%" height="100%" minWidth={0}>
          {single ? (
            <BarChart data={byDay} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
              <CartesianGrid stroke={t.grid} vertical={false} />
              <XAxis dataKey="date" tickFormatter={dayLabel} stroke={t.text} tickLine={false} />
              <YAxis tickFormatter={compactINR} stroke={t.text} tickLine={false} axisLine={false} width={56} />
              <Tooltip contentStyle={tooltipStyle} labelFormatter={(l) => dayLong(String(l))} formatter={(v) => [formatINR(Number(v)), "Revenue"]} cursor={{ fill: t.grid, opacity: 0.4 }} />
              <Bar dataKey="revenue" isAnimationActive={false} fill={t.primary} radius={[6, 6, 0, 0]} maxBarSize={72} />
            </BarChart>
          ) : (
            <AreaChart data={byDay} margin={{ top: 8, right: 12, bottom: 0, left: 0 }}>
              <CartesianGrid stroke={t.grid} vertical={false} />
              <XAxis dataKey="date" tickFormatter={dayLabel} stroke={t.text} tickLine={false} minTickGap={24} />
              <YAxis tickFormatter={compactINR} stroke={t.text} tickLine={false} axisLine={false} width={56} />
              <Tooltip contentStyle={tooltipStyle} labelFormatter={(l) => dayLong(String(l))} formatter={(v) => [formatINR(Number(v)), "Revenue"]} />
              <Area type="monotone" isAnimationActive={false} dataKey="revenue" stroke={t.primary} strokeWidth={2.5} fill={t.primary} fillOpacity={0.15} dot={byDay.length <= 14} />
            </AreaChart>
          )}
        </ResponsiveContainer>
      </ChartCard>
    </div>
  );
}

export function OrdersByHourChart({ byHour }: { byHour: Summary["byHour"] }) {
  const [ref, t] = useChartTokens();
  const busy = byHour.reduce((m, h) => (h.orders > m.orders ? h : m), byHour[0]);
  const title = busy.orders === 0 ? "No paid orders to show by hour yet" : `Busiest hour: ${hourLabel(busy.hour)} with ${busy.orders} ${busy.orders === 1 ? "order" : "orders"}`;
  // Trim the empty small hours so the bars stay readable: show the café's day (7 AM to 11 PM) plus anything outside it.
  const used = byHour.filter((h) => h.orders > 0).map((h) => h.hour);
  const lo = Math.min(7, ...used);
  const hi = Math.max(23, ...used);
  const data = byHour.filter((h) => h.hour >= lo && h.hour <= hi);
  return (
    <div ref={ref}>
      <ChartCard
        title={title}
        summary={`Orders by hour of day, ${byHour.reduce((s, h) => s + h.orders, 0)} paid orders in total.`}
        table={
          <table className="sr-only">
            <caption>Paid orders by hour</caption>
            <thead>
              <tr>
                <th>Hour</th>
                <th>Orders</th>
                <th>Revenue</th>
              </tr>
            </thead>
            <tbody>
              {data.map((h) => (
                <tr key={h.hour}>
                  <td>{hourLabel(h.hour)}</td>
                  <td>{h.orders}</td>
                  <td>{formatINR(h.revenue)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        }
      >
        <ResponsiveContainer width="100%" height="100%" minWidth={0}>
          <BarChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
            <CartesianGrid stroke={t.grid} vertical={false} />
            <XAxis dataKey="hour" tickFormatter={(h) => hourLabel(Number(h))} stroke={t.text} tickLine={false} interval="preserveStartEnd" minTickGap={16} />
            <YAxis allowDecimals={false} stroke={t.text} tickLine={false} axisLine={false} width={32} />
            <Tooltip contentStyle={tooltipStyle} labelFormatter={(h) => hourLabel(Number(h))} formatter={(v, name) => [name === "revenue" ? formatINR(Number(v)) : v, name === "revenue" ? "Revenue" : "Orders"]} cursor={{ fill: t.grid, opacity: 0.4 }} />
            <Bar dataKey="orders" isAnimationActive={false} fill={t.second} radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </ChartCard>
    </div>
  );
}

export type Part = { label: string; value: number };
// Series colours are CSS tokens, never hex. A gap between segments plus the text legend means colour is never the only signal.
const SEGMENT_COLOURS = ["var(--primary)", "var(--chart-5)", "var(--foreground)"];

/** One horizontal stacked bar with a legend that spells out each count and share. */
export function StackedBar({ title, parts, unit = "orders" }: { title: string; parts: Part[]; unit?: string }) {
  const total = parts.reduce((s, p) => s + p.value, 0);
  const pct = (v: number) => (total ? Math.round((v / total) * 100) : 0);
  const summary = total ? parts.map((p) => `${p.label} ${p.value} (${pct(p.value)}%)`).join(", ") : `No ${unit} yet`;
  return (
    <section aria-label={title} className="rounded-2xl border border-border bg-card p-4 sm:p-5">
      <h3 className="mb-3 text-lg font-bold">{title}</h3>
      <div role="img" aria-label={`${title}: ${summary}`} className="flex h-6 w-full gap-0.5 overflow-hidden rounded-full bg-muted">
        {total > 0 &&
          parts.map(
            (p, i) =>
              p.value > 0 && <span key={p.label} className="h-full" style={{ width: `${(p.value / total) * 100}%`, background: SEGMENT_COLOURS[i % SEGMENT_COLOURS.length] }} />,
          )}
      </div>
      <ul className="mt-3 grid gap-1.5 text-base">
        {parts.map((p, i) => (
          <li key={p.label} className="flex items-center gap-2">
            <span aria-hidden="true" className="size-3 shrink-0 rounded-sm" style={{ background: SEGMENT_COLOURS[i % SEGMENT_COLOURS.length] }} />
            <span className="flex-1">{p.label}</span>
            <span className="font-bold tabular-nums">{p.value}</span>
            <span className="w-12 text-right text-sm text-muted-foreground tabular-nums">{pct(p.value)}%</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
