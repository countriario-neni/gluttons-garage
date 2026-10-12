"use client";

import { useState, type FormEvent, type ReactNode } from "react";
import { cn } from "cn";
import { Loader2, Pencil, Plus } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatINR } from "@/domain/money";
import type { Coupon } from "@/domain/types";
import { useLive, useStore } from "@/store";
import { dayLabel } from "./crm-format";
import { staffErrorCopy } from "./format";

const IST = "Asia/Kolkata";
/** yyyy-mm-dd of an instant in café time (what <input type=date> wants). */
const toDateInput = (iso: string) => new Date(iso).toLocaleDateString("en-CA", { timeZone: IST });
/** A coupon dated D works through the end of D, café time. */
const fromDateInput = (d: string) => new Date(`${d}T23:59:59+05:30`).toISOString();

export type CouponForm = {
  code: string;
  type: Coupon["type"];
  value: string;
  minOrder: string;
  maxDiscount: string;
  expiresAt: string;
  usageLimit: string;
  firstOrderOnly: boolean;
  active: boolean;
};
export type CouponErrors = Partial<Record<"code" | "value" | "minOrder" | "maxDiscount" | "usageLimit", string>>;

const blank: CouponForm = { code: "", type: "percent", value: "", minOrder: "0", maxDiscount: "", expiresAt: "", usageLimit: "", firstOrderOnly: false, active: true };

const formOf = (c: Coupon): CouponForm => ({
  code: c.code,
  type: c.type,
  value: String(c.value),
  minOrder: String(c.minOrder),
  maxDiscount: c.maxDiscount === null ? "" : String(c.maxDiscount),
  expiresAt: c.expiresAt ? toDateInput(c.expiresAt) : "",
  usageLimit: c.usageLimit === null ? "" : String(c.usageLimit),
  firstOrderOnly: c.firstOrderOnly,
  active: c.active,
});

const wholeNumber = (s: string) => /^\d+$/.test(s.trim());

/** Inline validation: code is uppercase A–Z/0–9, 3–20 chars and unique; amounts are whole rupees. */
export function validateCoupon(f: CouponForm, existing: string[], editing: boolean): CouponErrors {
  const e: CouponErrors = {};
  const code = f.code.trim().toUpperCase();
  if (!/^[A-Z0-9]{3,20}$/.test(code)) e.code = "Use 3 to 20 letters or numbers, no spaces.";
  else if (!editing && existing.includes(code)) e.code = "That code already exists.";
  if (!wholeNumber(f.value) || Number(f.value) < 1) e.value = f.type === "percent" ? "Enter a percentage from 1 to 100." : "Enter an amount of ₹1 or more.";
  else if (f.type === "percent" && Number(f.value) > 100) e.value = "Enter a percentage from 1 to 100.";
  if (!wholeNumber(f.minOrder)) e.minOrder = "Enter 0 or more.";
  if (f.type === "percent" && f.maxDiscount.trim() !== "" && (!wholeNumber(f.maxDiscount) || Number(f.maxDiscount) < 1)) e.maxDiscount = "Enter an amount of ₹1 or more, or leave blank.";
  if (f.usageLimit.trim() !== "" && (!wholeNumber(f.usageLimit) || Number(f.usageLimit) < 1)) e.usageLimit = "Enter 1 or more, or leave blank for unlimited.";
  return e;
}

function toCoupon(f: CouponForm, usedCount: number): Coupon {
  return {
    code: f.code.trim().toUpperCase(),
    type: f.type,
    value: Number(f.value),
    minOrder: Number(f.minOrder),
    maxDiscount: f.type === "percent" && f.maxDiscount.trim() !== "" ? Number(f.maxDiscount) : null,
    expiresAt: f.expiresAt ? fromDateInput(f.expiresAt) : null,
    usageLimit: f.usageLimit.trim() !== "" ? Number(f.usageLimit) : null,
    usedCount,
    firstOrderOnly: f.firstOrderOnly,
    active: f.active,
  };
}

const describe = (c: Coupon) =>
  `${c.type === "percent" ? `${c.value}% off` : `${formatINR(c.value)} off`}${c.maxDiscount !== null ? ` (max ${formatINR(c.maxDiscount)})` : ""}${
    c.minOrder ? ` · min ${formatINR(c.minOrder)}` : ""
  }${c.firstOrderOnly ? " · first order only" : ""}`;

function statusOf(c: Coupon, now: number): { label: string; tone: "ok" | "off" } {
  if (!c.active) return { label: "Paused", tone: "off" };
  if (c.expiresAt && new Date(c.expiresAt).getTime() < now) return { label: "Expired", tone: "off" };
  if (c.usageLimit !== null && c.usedCount >= c.usageLimit) return { label: "Used up", tone: "off" };
  return { label: "Live", tone: "ok" };
}

function Field({ label, id, error, hint, children }: { label: string; id: string; error?: string; hint?: string; children: ReactNode }) {
  return (
    <div className="grid gap-1.5">
      <Label htmlFor={id} className="text-base font-bold">
        {label}
      </Label>
      {children}
      {error ? (
        <p id={`${id}-msg`} role="alert" className="text-sm font-bold text-destructive">
          {error}
        </p>
      ) : (
        hint && (
          <p id={`${id}-msg`} className="text-sm text-muted-foreground">
            {hint}
          </p>
        )
      )}
    </div>
  );
}

function CouponDialog({ initial, existing, onClose }: { initial: Coupon | null; existing: string[]; onClose: () => void }) {
  const store = useStore();
  const editing = initial !== null;
  const [f, setF] = useState<CouponForm>(initial ? formOf(initial) : blank);
  const [tried, setTried] = useState(false);
  const [pending, setPending] = useState(false);
  const errors = validateCoupon(f, existing, editing);
  const shown = tried ? errors : {};
  const set = <K extends keyof CouponForm>(k: K, v: CouponForm[K]) => setF((x) => ({ ...x, [k]: v }));
  const aria = (k: keyof CouponErrors) => ({ "aria-invalid": shown[k] ? true : undefined, "aria-describedby": `c-${k}-msg` });

  async function submit(e: FormEvent) {
    e.preventDefault();
    setTried(true);
    if (Object.keys(errors).length) return;
    setPending(true);
    try {
      const c = toCoupon(f, initial?.usedCount ?? 0);
      await store.upsertCoupon(c);
      toast.success(editing ? `${c.code} updated` : `${c.code} created`);
      onClose();
    } catch (err) {
      toast.error(staffErrorCopy(err));
      setPending(false);
    }
  }

  return (
    <Dialog open onOpenChange={(o) => !o && !pending && onClose()}>
      <DialogContent className="theme-kitchen max-h-[92dvh] gap-4 overflow-y-auto p-6 shadow-lift ring-2 ring-primary/50 sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold">{editing ? `Edit ${initial.code}` : "New coupon"}</DialogTitle>
          <DialogDescription className="text-base">Customers enter the code at checkout.</DialogDescription>
        </DialogHeader>
        <form noValidate className="grid gap-4" onSubmit={(e) => void submit(e)}>
          <Field label="Code" id="c-code" error={shown.code} hint="Letters and numbers only. Saved in capitals.">
            <Input
              id="c-code"
              value={f.code}
              disabled={editing}
              autoComplete="off"
              maxLength={20}
              onChange={(e) => set("code", e.target.value.toUpperCase().replace(/\s/g, ""))}
              className="h-11 text-base uppercase"
              {...aria("code")}
            />
          </Field>

          <fieldset className="grid gap-1.5">
            <legend className="text-base font-bold">Discount type</legend>
            <div className="flex gap-2">
              {(["percent", "flat"] as const).map((t) => (
                <label
                  key={t}
                  className={cn(
                    "flex h-11 flex-1 cursor-pointer items-center justify-center rounded-lg border text-base font-bold has-[:focus-visible]:ring-3 has-[:focus-visible]:ring-ring/50",
                    f.type === t ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card",
                  )}
                >
                  <input type="radio" name="c-type" className="sr-only" checked={f.type === t} onChange={() => set("type", t)} />
                  {t === "percent" ? "Percent off" : "Flat ₹ off"}
                </label>
              ))}
            </div>
          </fieldset>

          <div className="grid grid-cols-2 gap-3">
            <Field label={f.type === "percent" ? "Percent" : "Amount (₹)"} id="c-value" error={shown.value}>
              <Input id="c-value" inputMode="numeric" value={f.value} onChange={(e) => set("value", e.target.value)} className="h-11 text-base" {...aria("value")} />
            </Field>
            <Field label="Minimum order (₹)" id="c-minOrder" error={shown.minOrder}>
              <Input id="c-minOrder" inputMode="numeric" value={f.minOrder} onChange={(e) => set("minOrder", e.target.value)} className="h-11 text-base" {...aria("minOrder")} />
            </Field>
            {f.type === "percent" && (
              <Field label="Max discount (₹)" id="c-maxDiscount" error={shown.maxDiscount} hint="Optional cap.">
                <Input id="c-maxDiscount" inputMode="numeric" value={f.maxDiscount} onChange={(e) => set("maxDiscount", e.target.value)} className="h-11 text-base" {...aria("maxDiscount")} />
              </Field>
            )}
            <Field label="Usage limit" id="c-usageLimit" error={shown.usageLimit} hint="Blank = unlimited.">
              <Input id="c-usageLimit" inputMode="numeric" value={f.usageLimit} onChange={(e) => set("usageLimit", e.target.value)} className="h-11 text-base" {...aria("usageLimit")} />
            </Field>
            <Field label="Expires on" id="c-expiresAt" hint="Blank = never. Valid through that day.">
              <Input id="c-expiresAt" type="date" value={f.expiresAt} onChange={(e) => set("expiresAt", e.target.value)} className="h-11 text-base" aria-describedby="c-expiresAt-msg" />
            </Field>
          </div>

          <div className="grid gap-3 rounded-xl bg-card p-4">
            <label className="flex min-h-11 items-center justify-between gap-3 text-base font-bold">
              First order only
              <Switch checked={f.firstOrderOnly} onCheckedChange={(v) => set("firstOrderOnly", v)} />
            </label>
            <label className="flex min-h-11 items-center justify-between gap-3 text-base font-bold">
              Active
              <Switch checked={f.active} onCheckedChange={(v) => set("active", v)} />
            </label>
          </div>

          <DialogFooter className="-mx-6 -mb-6 bg-card p-4">
            <Button type="button" variant="outline" className="h-12 px-5 text-base" disabled={pending} onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" className="h-12 px-5 text-base font-bold" disabled={pending}>
              {pending && <Loader2 className="size-5 animate-spin motion-reduce:animate-none" aria-hidden="true" />}
              {editing ? "Save changes" : "Create coupon"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function CouponEditor() {
  const store = useStore();
  const { data, loading } = useLive("menu", (s) => s.listCoupons());
  const [editing, setEditing] = useState<Coupon | "new" | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [now] = useState(() => Date.now());
  const coupons = data ?? [];

  async function toggle(c: Coupon, active: boolean) {
    setBusy(c.code);
    try {
      await store.upsertCoupon({ ...c, active });
      toast.success(`${c.code} ${active ? "is live" : "paused"}`);
    } catch (e) {
      toast.error(staffErrorCopy(e));
    } finally {
      setBusy(null);
    }
  }

  return (
    <section aria-labelledby="coupons-h" className="grid gap-3">
      <div className="flex flex-wrap items-center gap-3">
        <h2 id="coupons-h" className="text-xl font-bold">
          Coupons
        </h2>
        <Button className="ml-auto h-11 px-4 text-base font-bold" onClick={() => setEditing("new")}>
          <Plus className="size-5" aria-hidden="true" /> New coupon
        </Button>
      </div>

      <div className="overflow-hidden rounded-xl bg-card shadow-card">
        <Table aria-label="Coupons">
          <TableHeader>
            <TableRow>
              <TableHead className="h-12 px-4 font-bold">Code</TableHead>
              <TableHead className="hidden h-12 px-4 font-bold md:table-cell">Offer</TableHead>
              <TableHead className="h-12 px-4 text-right font-bold">Used</TableHead>
              <TableHead className="hidden h-12 px-4 font-bold sm:table-cell">Status</TableHead>
              <TableHead className="h-12 px-4 font-bold">Active</TableHead>
              <TableHead className="h-12 px-4">
                <span className="sr-only">Edit</span>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {coupons.map((c) => {
              const st = statusOf(c, now);
              return (
                <TableRow key={c.code} data-testid="coupon-row">
                  <TableCell className="px-4 py-3 whitespace-normal">
                    <div className="font-mono text-base font-bold">{c.code}</div>
                    <div className="text-sm text-muted-foreground md:hidden">{describe(c)}</div>
                  </TableCell>
                  <TableCell className="hidden px-4 text-base whitespace-normal md:table-cell">
                    {describe(c)}
                    {c.expiresAt && <div className="text-sm text-muted-foreground">Expires {dayLabel(c.expiresAt)}</div>}
                  </TableCell>
                  <TableCell className="px-4 text-right text-base tabular-nums">
                    {c.usedCount}
                    {c.usageLimit !== null ? ` / ${c.usageLimit}` : ""}
                  </TableCell>
                  <TableCell className="hidden px-4 sm:table-cell">
                    <Badge variant={st.tone === "ok" ? "default" : "outline"} className="h-6 px-2.5 text-xs font-bold">
                      {st.label}
                    </Badge>
                  </TableCell>
                  <TableCell className="px-4">
                    <Switch
                      aria-label={`${c.code} active`}
                      checked={c.active}
                      disabled={busy === c.code}
                      onCheckedChange={(v) => void toggle(c, v)}
                    />
                  </TableCell>
                  <TableCell className="px-2 text-right">
                    <Button variant="ghost" size="icon" aria-label={`Edit ${c.code}`} onClick={() => setEditing(c)}>
                      <Pencil className="size-5" aria-hidden="true" />
                    </Button>
                  </TableCell>
                </TableRow>
              );
            })}
            {coupons.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="px-4 py-8 text-center text-muted-foreground">
                  {loading ? "Loading coupons…" : "No coupons yet."}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      {editing && (
        <CouponDialog
          initial={editing === "new" ? null : editing}
          existing={coupons.map((c) => c.code.toUpperCase())}
          onClose={() => setEditing(null)}
        />
      )}
    </section>
  );
}
