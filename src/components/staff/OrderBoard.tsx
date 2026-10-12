"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState, useSyncExternalStore, type ReactNode } from "react";
import { cn } from "cn";
import { BellRing, ChevronDown, CircleCheckBig, Inbox, PackageCheck, RefreshCw, Utensils, Volume2, VolumeX } from "lucide-react";
import { toast } from "sonner";
import { clockTime } from "@/components/track/format";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { formatINR } from "@/domain/money";
import type { OrderStatus } from "@/domain/types";
import { useLive, type DataStore } from "@/store";
import type { Order } from "@/store/DataStore";
import { cafeDayStartIso, newOrderLine, placeLabel } from "./format";
import { NowContext, OrderCard } from "./OrderCard";
import { loginHref } from "./RequireStaff";
import { DEMO_RESET_EVENT } from "./StaffShell";
import { useKitchenSound } from "./useKitchenSound";

const ACTIVE: OrderStatus[] = ["placed", "accepted", "preparing", "ready"];
const BASE_TITLE = "Orders · Gluttons Garage";

type ColumnKey = "new" | "preparing" | "ready";
const COLUMNS: { key: ColumnKey; title: "New" | "Preparing" | "Ready"; statuses: OrderStatus[]; empty: string; icon: typeof Inbox }[] = [
  { key: "new", title: "New", statuses: ["placed"], empty: "No new orders. New ones pop in here with a chime.", icon: Inbox },
  { key: "preparing", title: "Preparing", statuses: ["accepted", "preparing"], empty: "Nothing on the stove.", icon: Utensils },
  { key: "ready", title: "Ready", statuses: ["ready"], empty: "Nothing waiting for pickup.", icon: PackageCheck },
];

type BoardData = { active: Order[]; completed: Order[] };

async function loadBoard(s: DataStore): Promise<BoardData> {
  const [active, completed] = await Promise.all([
    s.listOrders({ statuses: ACTIVE }),
    s.listOrders({ from: cafeDayStartIso(Date.now()), statuses: ["completed"] }),
  ]);
  // Kitchen order: oldest first, so the longest-waiting ticket is on top.
  active.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  completed.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  return { active, completed };
}

const wideQuery = "(min-width: 1280px)";
const subscribeWide = (cb: () => void) => {
  const m = window.matchMedia(wideQuery);
  m.addEventListener("change", cb);
  return () => m.removeEventListener("change", cb);
};
/** Three columns on wide screens; tabs per column on tablets and phones. */
const useWide = () =>
  useSyncExternalStore(
    subscribeWide,
    () => window.matchMedia(wideQuery).matches,
    () => true,
  );

/** One shared ticking clock for the header and every card's elapsed timer. */
function useTick(ms: number) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), ms);
    return () => clearInterval(t);
  }, [ms]);
  return now;
}

export function OrderBoard() {
  const router = useRouter();
  const now = useTick(1000);
  const wide = useWide();
  const sound = useKitchenSound();
  const [fresh, setFresh] = useState<ReadonlySet<string>>(new Set());
  const [tab, setTab] = useState<ColumnKey>("new");

  // New-order detection: ids seen so far (null = next load only primes it, e.g. the first load or after a reset).
  const seen = useRef<Set<string> | null>(null);
  const alert = useRef<(orders: Order[]) => void>(() => {});
  useEffect(() => {
    alert.current = (incoming) => {
      setFresh((f) => new Set([...f, ...incoming.map((o) => o.id)]));
      for (const o of incoming) toast(newOrderLine(o), { icon: <BellRing className="size-5" aria-hidden="true" /> });
      sound.play();
    };
  });
  useEffect(() => {
    const reprime = () => void (seen.current = null);
    window.addEventListener(DEMO_RESET_EVENT, reprime);
    return () => window.removeEventListener(DEMO_RESET_EVENT, reprime);
  }, []);

  const loader = useCallback(async (s: DataStore) => {
    const data = await loadBoard(s);
    const prev = seen.current;
    seen.current = new Set([...(prev ?? []), ...data.active.map((o) => o.id), ...data.completed.map((o) => o.id)]);
    if (prev) {
      const incoming = data.active.filter((o) => o.status === "placed" && !prev.has(o.id));
      if (incoming.length) alert.current(incoming);
    }
    return data;
  }, []);
  const { data, error, reload } = useLive("orders", loader);

  useEffect(() => {
    if (error?.message === "UNAUTHENTICATED") router.replace(loginHref("/staff/orders/"));
  }, [error, router]);

  const placedIds = new Set(data?.active.filter((o) => o.status === "placed").map((o) => o.id));
  const unacked = [...fresh].filter((id) => placedIds.has(id));
  const unackedCount = unacked.length;
  useEffect(() => {
    document.title = unackedCount ? `(${unackedCount}) ${BASE_TITLE}` : BASE_TITLE;
  }, [unackedCount]);
  useEffect(() => () => void (document.title = BASE_TITLE), []);

  const acknowledge = useCallback((id: string) => {
    setFresh((f) => {
      if (!f.has(id)) return f;
      const n = new Set(f);
      n.delete(id);
      return n;
    });
  }, []);

  const byColumn = (c: (typeof COLUMNS)[number]) => data?.active.filter((o) => c.statuses.includes(o.status)) ?? [];
  const column = (c: (typeof COLUMNS)[number]) => (
    <Column key={c.key} title={c.title} count={byColumn(c).length} loading={!data} empty={c.empty} icon={c.icon} headless={!wide}>
      {byColumn(c).map((o) => (
        <OrderCard key={o.id} order={o} fresh={fresh.has(o.id) && o.status === "placed"} onAcknowledge={acknowledge} />
      ))}
    </Column>
  );

  return (
    <NowContext.Provider value={now}>
      <header className="sticky top-0 z-30 flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-border bg-background/95 px-4 py-3 backdrop-blur sm:px-6">
        <div className="flex items-baseline gap-3">
          <h1 className="font-sans text-3xl font-extrabold tracking-tight">Orders</h1>
          <p className="text-2xl font-bold text-muted-foreground tabular-nums" aria-label={`Café time ${clockTime(new Date(now).toISOString())}`}>
            <time dateTime={new Date(now).toISOString()}>{clockTime(new Date(now).toISOString())}</time>
          </p>
        </div>

        {wide && data && (
          <ul className="flex gap-2 text-sm font-bold" aria-label="Orders per column">
            {COLUMNS.map((c) => (
              <li key={c.key} className="rounded-full bg-muted px-3 py-1">
                {c.title} <span className="tabular-nums">{byColumn(c).length}</span>
              </li>
            ))}
          </ul>
        )}

        <div className="ml-auto flex items-center gap-2">
          {unackedCount > 0 && (
            <Button
              className="h-11 px-4 text-base font-extrabold motion-safe:animate-pulse"
              onClick={() => {
                setFresh(new Set());
                setTab("new");
              }}
            >
              <BellRing className="size-5" aria-hidden="true" />
              {unackedCount} new<span className="hidden sm:inline"> · mark seen</span>
            </Button>
          )}
          {sound.on ? (
            <Button variant="outline" className="h-11 px-4 text-base" aria-pressed onClick={sound.disable}>
              <Volume2 className="size-5" aria-hidden="true" /> <span className="sr-only sm:not-sr-only">Sound on</span>
            </Button>
          ) : (
            <Button variant="secondary" className="h-11 px-4 text-base" aria-pressed={false} onClick={() => void sound.enable()}>
              <VolumeX className="size-5" aria-hidden="true" /> <span className="sr-only sm:not-sr-only">Enable sound</span>
            </Button>
          )}
        </div>
      </header>

      <main className="flex flex-1 flex-col gap-6 p-4 sm:p-6">
        {error && !data ? (
          <div role="alert" className="grid place-items-center gap-4 rounded-2xl border border-border bg-card p-10 text-center">
            <p className="text-xl font-bold">Couldn&apos;t load orders.</p>
            <Button className="h-12 px-5 text-base" onClick={() => void reload()}>
              <RefreshCw className="size-5" aria-hidden="true" /> Try again
            </Button>
          </div>
        ) : wide ? (
          <div className="grid grid-cols-3 items-start gap-5">{COLUMNS.map(column)}</div>
        ) : (
          <Tabs value={tab} onValueChange={(v) => setTab(v as ColumnKey)} className="gap-4">
            <TabsList className="sticky top-[4.75rem] z-20 grid h-14! w-full grid-cols-3 rounded-xl bg-card p-1">
              {COLUMNS.map((c) => (
                <TabsTrigger key={c.key} value={c.key} className="h-12 rounded-lg text-base font-bold data-active:bg-primary data-active:text-primary-foreground">
                  {c.title}
                  <span className="rounded-full bg-muted px-2 text-sm text-foreground tabular-nums">{data ? byColumn(c).length : "–"}</span>
                </TabsTrigger>
              ))}
            </TabsList>
            {COLUMNS.map((c) => (
              <TabsContent key={c.key} value={c.key}>
                {column(c)}
              </TabsContent>
            ))}
          </Tabs>
        )}

        {data && <CompletedToday orders={data.completed} />}
      </main>
    </NowContext.Provider>
  );
}

function Column(p: {
  title: string;
  count: number;
  loading: boolean;
  empty: string;
  icon: typeof Inbox;
  headless: boolean;
  children: ReactNode;
}) {
  const Icon = p.icon;
  return (
    <section aria-label={p.title} className="flex min-w-0 flex-col gap-4">
      {!p.headless && (
        <h2 className="flex items-center justify-between rounded-xl bg-card px-4 py-3 font-sans text-xl font-extrabold tracking-wide uppercase">
          {p.title}
          <span className={cn("grid min-w-9 place-items-center rounded-full px-2 py-0.5 text-lg tabular-nums", p.count ? "bg-primary text-primary-foreground" : "bg-muted")}>
            {p.loading ? "–" : p.count}
          </span>
        </h2>
      )}
      {p.loading ? (
        <div aria-hidden="true" className="h-56 animate-pulse rounded-2xl bg-card motion-reduce:animate-none" />
      ) : p.count === 0 ? (
        <p className="flex flex-col items-center gap-2 rounded-2xl border-2 border-dashed border-border px-4 py-10 text-center text-base text-muted-foreground">
          <Icon className="size-8" aria-hidden="true" />
          {p.empty}
        </p>
      ) : (
        p.children
      )}
    </section>
  );
}

function CompletedToday({ orders }: { orders: Order[] }) {
  const [open, setOpen] = useState(false);
  const total = orders.reduce((s, o) => s + o.bill.total, 0);
  return (
    <div className="rounded-2xl border border-border bg-card">
      <button
        type="button"
        aria-expanded={open}
        aria-controls="completed-today"
        onClick={() => setOpen((v) => !v)}
        className="flex min-h-14 w-full items-center gap-3 rounded-2xl px-4 text-left text-lg font-bold hover:bg-muted"
      >
        <CircleCheckBig className="size-5 text-success" aria-hidden="true" />
        Completed today
        <span className="rounded-full bg-muted px-2.5 text-base tabular-nums">{orders.length}</span>
        <span className="ml-auto text-base font-normal text-muted-foreground tabular-nums">{formatINR(total)}</span>
        <ChevronDown className={cn("size-5 transition-transform", open && "rotate-180")} aria-hidden="true" />
      </button>
      {open && (
        <section id="completed-today" aria-label="Completed today" className="border-t border-border px-4 pb-2">
          {orders.length === 0 ? (
            <p className="py-4 text-muted-foreground">No completed orders yet today.</p>
          ) : (
            <ul className="divide-y divide-border">
              {orders.map((o) => (
                <li key={o.id} className="grid grid-cols-[6.5rem_1fr_auto] items-center gap-3 py-3 text-base sm:grid-cols-[6.5rem_12rem_1fr_auto_auto]">
                  <span className="font-extrabold tabular-nums">{o.code}</span>
                  <span className="font-bold">{placeLabel(o)}</span>
                  <span className="hidden truncate text-muted-foreground sm:block">
                    {o.bill.lines.map((l) => `${l.qty}× ${l.name}`).join(", ")}
                  </span>
                  <span className="hidden text-muted-foreground tabular-nums sm:block">{clockTime(o.updatedAt)}</span>
                  <span className="text-right font-bold tabular-nums">{formatINR(o.bill.total)}</span>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}
    </div>
  );
}
