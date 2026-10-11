"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { QrCode } from "lucide-react";
import { useEffect, useRef } from "react";
import { Container } from "@/components/site/primitives/Container";
import { ensureCartHydrated, useCart } from "@/lib/cart";
import { StoreProvider, useLive } from "@/store";
import { TableGrid } from "./TableGrid";

/** /t/?table=N (printed table QR): valid N starts a dine-in order; anything else shows a table picker. */
export function TableLanding() {
  return (
    <StoreProvider>
      <Landing />
    </StoreProvider>
  );
}

const parseTable = (raw: string | null, max: number): number | null => {
  if (!raw || !/^\d{1,3}$/.test(raw.trim())) return null;
  const n = Number(raw.trim());
  return n >= 1 && n <= max ? n : null;
};

function Landing() {
  const router = useRouter();
  const params = useSearchParams();
  const raw = params.get("table");
  const { data: settings } = useLive("menu", (s) => s.getSettings());
  const tables = settings?.tables ?? null;
  const valid = tables === null ? null : parseTable(raw, tables);
  const started = useRef(false);

  const start = async (table: number) => {
    if (started.current) return;
    started.current = true;
    await ensureCartHydrated();
    useCart.getState().setMode("dine_in", table);
    router.replace("/order/");
  };

  useEffect(() => {
    if (valid !== null) void start(valid);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- start is stable in effect (guarded by ref)
  }, [valid]);

  if (tables === null || valid !== null) {
    return (
      <div role="status" className="grid min-h-[50vh] place-items-center">
        <p className="flex items-center gap-3 font-bold text-primary">
          <span aria-hidden="true" className="size-5 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          {valid !== null ? `Taking you to Table ${valid}…` : "Finding your table…"}
        </p>
      </div>
    );
  }

  return (
    <Container className="max-w-xl py-10 sm:py-16">
      <div className="rounded-3xl border border-border bg-card p-6 shadow-card sm:p-8">
        <span className="grid size-12 place-items-center rounded-full bg-secondary text-primary">
          <QrCode className="size-6" aria-hidden="true" />
        </span>
        <h1 className="mt-4 text-3xl font-bold text-primary">Choose your table</h1>
        <p className="mt-2 text-muted-foreground">
          {raw
            ? `We couldn't find table “${raw.slice(0, 12)}”. Pick your table number below. It's printed on the stand at your table.`
            : "Pick your table number below. It's printed on the stand at your table."}
        </p>
        <div className="mt-6">
          <TableGrid count={tables} onPick={(t) => void start(t)} />
        </div>
        <p className="mt-6 text-sm text-muted-foreground">
          Ordering for pickup instead?{" "}
          <Link href="/order/" className="font-bold text-primary underline underline-offset-4">
            Choose takeaway
          </Link>
        </p>
      </div>
    </Container>
  );
}
