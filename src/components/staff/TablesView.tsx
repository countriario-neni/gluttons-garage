"use client";

import { useState, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import { Lock, Printer } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useLive, useStore } from "@/store";
import { useStaffSession } from "./RequireStaff";
import { TableQrCard } from "./TableQrCard";

const MAX_TABLES = 50;

/** Reuses the global invoice-print rule (hides every other body child, and this one on screen) to print only the portalled sheet: A4, two columns by three rows, six cards per page. */
const PRINT_CSS = `
@page { size: A4; margin: 10mm; }
@media print {
  .qr-print.invoice-print { display: grid; grid-template-columns: repeat(2, 1fr); gap: 4mm 6mm; background: #fff; }
  .qr-print .qr-card { height: 88mm; break-inside: avoid; padding: 3mm !important; gap: 1.5mm !important; justify-content: center; }
  .qr-print .qr-img { width: auto; height: 38mm; max-width: none; }
  .qr-print .qr-card:nth-child(6n + 1):not(:first-child) { break-before: page; }
}`;

export function TablesView() {
  const { role } = useStaffSession();
  const owner = role === "owner";
  const store = useStore();
  const { data: settings, error } = useLive("menu", (s) => s.getSettings());
  const [draft, setDraft] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const mounted = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );
  const count = settings?.tables ?? 0;
  const shown = draft ?? String(count);

  async function saveCount() {
    const n = Number(shown);
    if (!/^\d+$/.test(shown.trim()) || n < 1 || n > MAX_TABLES) return void toast.error(`Tables must be a whole number from 1 to ${MAX_TABLES}.`);
    setSaving(true);
    try {
      await store.updateSettings({ tables: n });
      setDraft(null);
      toast.success(`Now ${n} tables`);
    } catch {
      toast.error("Couldn't update the table count.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <style>{PRINT_CSS}</style>
      <header className="sticky top-0 z-30 flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-border bg-background/95 px-4 py-3 backdrop-blur sm:px-6">
        <h1 className="font-sans text-3xl font-extrabold tracking-tight">Tables</h1>
        <p className="text-base font-bold text-muted-foreground tabular-nums">{count} QR codes</p>
        <Button className="ml-auto h-11 px-4 text-base" disabled={!count} onClick={() => window.print()}>
          <Printer className="size-5" aria-hidden="true" /> Print all
        </Button>
      </header>

      <main className="flex flex-1 flex-col gap-5 p-4 sm:p-6">
        <section aria-label="Table count" className="flex flex-wrap items-end gap-3 rounded-2xl border border-border bg-card p-4">
          <div className="space-y-2">
            <Label htmlFor="table-count" className="text-base font-bold">Number of tables</Label>
            <Input
              id="table-count"
              inputMode="numeric"
              className="h-12 w-32 text-base tabular-nums"
              value={shown}
              disabled={!owner || !settings}
              onChange={(e) => setDraft(e.target.value)}
            />
          </div>
          {owner ? (
            <Button size="lg" disabled={saving || !settings || draft === null || draft === String(count)} onClick={() => void saveCount()}>
              Save
            </Button>
          ) : (
            <p className="flex items-center gap-2 text-base text-muted-foreground">
              <Lock className="size-5 shrink-0" aria-hidden="true" /> Only the owner can change the number of tables.
            </p>
          )}
          <p className="basis-full text-sm text-muted-foreground">
            Each code opens the order page with the table already chosen. Stick one on every table, 1 to {MAX_TABLES} allowed.
          </p>
        </section>

        {error && !settings ? (
          <p role="alert" className="rounded-2xl border border-border bg-card p-10 text-center text-xl font-bold">
            Couldn&apos;t load the tables.
          </p>
        ) : (
          <section aria-label="Table QR codes" className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4 2xl:grid-cols-5">
            {Array.from({ length: count }, (_, i) => (
              <TableQrCard key={i + 1} table={i + 1} />
            ))}
          </section>
        )}
      </main>
      {mounted &&
        createPortal(
          <div className="qr-print invoice-print" aria-hidden="true">
            {Array.from({ length: count }, (_, i) => (
              <TableQrCard key={i + 1} table={i + 1} printOnly />
            ))}
          </div>,
          document.body,
        )}
    </>
  );
}
