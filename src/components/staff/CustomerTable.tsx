"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { cn } from "cn";
import { ArrowDown, ArrowUp, ArrowUpDown, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatINR } from "@/domain/money";
import { useLive } from "@/store";
import type { CustomerStats } from "@/store/DataStore";
import { dayLabel, PhoneReveal, TAG_LABEL, TAGS, TagBadge } from "./crm-format";

type SortKey = "name" | "orders" | "totalSpend" | "lastOrderAt";
type Sort = { key: SortKey; dir: "asc" | "desc" };

const COLUMNS: { key: SortKey; label: string; numeric?: boolean; className?: string }[] = [
  { key: "name", label: "Customer" },
  { key: "orders", label: "Orders", numeric: true },
  { key: "totalSpend", label: "Spend", numeric: true },
  { key: "lastOrderAt", label: "Last order", className: "text-right" },
];

function compare(a: CustomerStats, b: CustomerStats, key: SortKey): number {
  if (key === "name") return a.name.localeCompare(b.name);
  if (key === "lastOrderAt") return (a.lastOrderAt ?? "").localeCompare(b.lastOrderAt ?? "");
  return a[key] - b[key];
}

const pct = (n: number, d: number) => (d ? `${Math.round((n / d) * 100)}%` : "0%");

function Kpi({ label, value, testId }: { label: string; value: string; testId: string }) {
  return (
    <div className="rounded-xl bg-card p-4 shadow-card">
      <dt className="text-sm text-muted-foreground">{label}</dt>
      <dd data-testid={testId} className="mt-1 text-3xl font-extrabold tabular-nums">
        {value}
      </dd>
    </div>
  );
}

export function CustomerTable() {
  const { data, error, loading } = useLive("orders", (s) => s.listCustomers());
  const [query, setQuery] = useState("");
  const [tag, setTag] = useState<CustomerStats["tags"][number] | null>(null);
  const [sort, setSort] = useState<Sort>({ key: "lastOrderAt", dir: "desc" });

  const kpis = useMemo(() => {
    const all = data ?? [];
    const spend = all.reduce((s, c) => s + c.totalSpend, 0);
    return {
      total: all.length,
      repeat: pct(all.filter((c) => c.orders >= 2).length, all.length),
      avg: formatINR(all.length ? Math.round(spend / all.length) : 0),
      optIn: pct(all.filter((c) => c.marketingOptIn).length, all.length),
    };
  }, [data]);

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    const digits = q.replace(/\D/g, "");
    const sign = sort.dir === "asc" ? 1 : -1;
    return (data ?? [])
      .filter((c) => !tag || c.tags.includes(tag))
      .filter((c) => !q || c.name.toLowerCase().includes(q) || (digits !== "" && c.phone.includes(digits)))
      .sort((a, b) => sign * compare(a, b, sort.key) || b.createdAt.localeCompare(a.createdAt));
  }, [data, query, tag, sort]);

  const toggleSort = (key: SortKey) =>
    setSort((s) => (s.key === key ? { key, dir: s.dir === "asc" ? "desc" : "asc" } : { key, dir: key === "name" ? "asc" : "desc" }));

  return (
    <div className="grid gap-5 px-4 py-5 sm:px-6">
      <header>
        <h1 className="font-sans text-3xl font-extrabold tracking-tight">Customers</h1>
        <p className="text-muted-foreground">Everyone who has ordered, with their loyalty and marketing status.</p>
      </header>

      <dl className="grid grid-cols-2 gap-3 lg:grid-cols-4" aria-label="Customer summary">
        <Kpi label="Total customers" value={String(kpis.total)} testId="kpi-total" />
        <Kpi label="Repeat rate" value={kpis.repeat} testId="kpi-repeat" />
        <Kpi label="Avg spend / customer" value={kpis.avg} testId="kpi-avg" />
        <Kpi label="Opted in to marketing" value={kpis.optIn} testId="kpi-optin" />
      </dl>

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative w-full sm:max-w-xs">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
          <Input
            type="search"
            aria-label="Search customers by name or phone"
            placeholder="Search name or phone"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="h-11 pl-9 text-base"
          />
        </div>
        <div role="group" aria-label="Filter by tag" className="flex flex-wrap gap-2">
          {[null, ...TAGS].map((t) => (
            <button
              key={t ?? "all"}
              type="button"
              aria-pressed={tag === t}
              onClick={() => setTag(t)}
              className={cn(
                "h-11 rounded-full border px-4 text-sm font-bold outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
                tag === t ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card hover:bg-muted",
              )}
            >
              {t ? TAG_LABEL[t] : "All"}
            </button>
          ))}
        </div>
      </div>

      {error && !data ? (
        <p role="alert" className="rounded-xl border border-destructive p-4 font-bold">
          Couldn&apos;t load customers. {error.message === "UNAUTHENTICATED" ? "Sign in again." : "Please refresh."}
        </p>
      ) : (
        <div className="overflow-hidden rounded-xl bg-card shadow-card">
          <Table>
            <TableHeader>
              <TableRow>
                {COLUMNS.map((c) => {
                  const active = sort.key === c.key;
                  const Icon = !active ? ArrowUpDown : sort.dir === "asc" ? ArrowUp : ArrowDown;
                  return (
                    <TableHead
                      key={c.key}
                      aria-sort={active ? (sort.dir === "asc" ? "ascending" : "descending") : "none"}
                      className={cn("h-12 px-2 sm:px-4", c.numeric && "text-right", c.className)}
                    >
                      <button
                        type="button"
                        onClick={() => toggleSort(c.key)}
                        className="inline-flex min-h-11 items-center gap-1 font-bold outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
                      >
                        {c.label}
                        <Icon className={cn("size-4", !active && "text-muted-foreground")} aria-hidden="true" />
                      </button>
                    </TableHead>
                  );
                })}
                <TableHead className="hidden h-12 px-2 sm:px-4 font-bold md:table-cell">Phone</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((c) => (
                <TableRow key={c.id} data-testid="customer-row">
                  <TableCell className="px-2 sm:px-4 py-3 whitespace-normal">
                    <Link
                      href={`/staff/customers/?id=${encodeURIComponent(c.id)}`}
                      prefetch={false}
                      className="inline-flex min-h-11 items-center text-base font-bold underline-offset-4 hover:underline focus-visible:underline"
                    >
                      {c.name}
                    </Link>
                    <div className="flex flex-wrap gap-1">
                      {c.tags.map((t) => (
                        <TagBadge key={t} tag={t} />
                      ))}
                    </div>
                  </TableCell>
                  <TableCell className="px-2 sm:px-4 text-right text-sm tabular-nums sm:text-base">{c.orders}</TableCell>
                  <TableCell className="px-2 sm:px-4 text-right text-sm tabular-nums sm:text-base">{formatINR(c.totalSpend)}</TableCell>
                  <TableCell className="px-2 whitespace-normal text-right text-sm sm:px-4 sm:text-base">{c.lastOrderAt ? dayLabel(c.lastOrderAt) : "Never"}</TableCell>
                  <TableCell className="hidden px-2 sm:px-4 md:table-cell">
                    <PhoneReveal phone={c.phone} />
                  </TableCell>
                </TableRow>
              ))}
              {rows.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="px-4 py-10 text-center text-muted-foreground">
                    {loading ? "Loading customers…" : "No customers match."}
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
