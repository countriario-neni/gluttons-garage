"use client";

import { useState, type ReactNode } from "react";
import { Loader2, Save } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useLive, useStore } from "@/store";
import type { Settings } from "@/store/DataStore";
import { staffErrorCopy } from "./format";

const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const DISPLAY_ORDER = [1, 2, 3, 4, 5, 6, 0];
const SLOTS = [10, 15, 20, 30];

type Form = {
  cafeName: string;
  phone: string;
  whatsapp: string;
  acceptingOrders: boolean;
  slotMinutes: number;
  hours: Settings["hours"];
  instagram: string;
  facebook: string;
  swiggy: string;
  zomato: string;
};
type Errors = Partial<Record<"cafeName" | "phone" | "whatsapp" | "instagram" | "facebook" | "swiggy" | "zomato", string>> & { hours: Record<number, string> };

const isUrl = (v: string) => {
  try {
    const u = new URL(v);
    return u.protocol === "https:" || u.protocol === "http:";
  } catch {
    return false;
  }
};

export function validateSettings(f: Form): Errors {
  const e: Errors = { hours: {} };
  if (!f.cafeName.trim()) e.cafeName = "Enter the café name.";
  if (f.phone.replace(/\D/g, "").length < 10) e.phone = "Enter a phone number with at least 10 digits.";
  if (f.whatsapp.replace(/\D/g, "").length < 10) e.whatsapp = "Enter a WhatsApp number with country code, e.g. 917702368884.";
  if (!isUrl(f.instagram.trim())) e.instagram = "Enter a full link starting with https://";
  for (const k of ["facebook", "swiggy", "zomato"] as const) {
    if (f[k].trim() && !isUrl(f[k].trim())) e[k] = "Enter a full link starting with https:// or leave empty.";
  }
  for (const d of DISPLAY_ORDER) {
    const h = f.hours[d];
    if (!h.open || !h.close) e.hours[d] = "Set both times.";
    else if (h.open >= h.close) e.hours[d] = "Opening time must be before closing time.";
  }
  return e;
}
const hasErrors = (e: Errors) => Object.keys(e.hours).length > 0 || Object.entries(e).some(([k, v]) => k !== "hours" && v);

function Field({ id, label, error, hint, children }: { id: string; label: string; error?: string; hint?: string; children: ReactNode }) {
  return (
    <div className="grid gap-1.5">
      <Label htmlFor={id} className="text-base">{label}</Label>
      {children}
      {hint && !error && <p className="text-sm text-muted-foreground">{hint}</p>}
      {error && (
        <p id={`${id}-err`} role="alert" className="text-sm font-bold text-destructive-foreground">
          {error}
        </p>
      )}
    </div>
  );
}

const Card = ({ title, children }: { title: string; children: ReactNode }) => (
  <section aria-label={title} className="grid content-start gap-4 rounded-2xl border border-border bg-card p-4 sm:p-6">
    <h2 className="text-xl font-bold">{title}</h2>
    {children}
  </section>
);

function SettingsEditor({ initial }: { initial: Settings }) {
  const store = useStore();
  const [f, setF] = useState<Form>({
    cafeName: initial.cafeName,
    phone: initial.phone,
    whatsapp: initial.whatsapp,
    acceptingOrders: initial.acceptingOrders,
    slotMinutes: initial.slotMinutes,
    hours: initial.hours,
    instagram: initial.socials.instagram,
    facebook: initial.socials.facebook ?? "",
    swiggy: initial.delivery.swiggy ?? "",
    zomato: initial.delivery.zomato ?? "",
  });
  const [showErrors, setShowErrors] = useState(false);
  const [saving, setSaving] = useState(false);
  const errors = validateSettings(f);
  const err = <K extends keyof Errors>(k: K) => (showErrors ? (errors[k] as string | undefined) : undefined);
  const set = <K extends keyof Form>(k: K, v: Form[K]) => setF((p) => ({ ...p, [k]: v }));
  const setHours = (d: number, k: "open" | "close", v: string) => setF((p) => ({ ...p, hours: { ...p.hours, [d]: { ...p.hours[d], [k]: v } } }));
  const props = (k: Exclude<keyof Errors, "hours">) => ({ "aria-invalid": Boolean(err(k)) || undefined, "aria-describedby": err(k) ? `s-${k}-err` : undefined });

  const save = async (ev: React.FormEvent) => {
    ev.preventDefault();
    setShowErrors(true);
    if (hasErrors(errors)) {
      toast.error("Fix the highlighted fields, then save again.");
      return;
    }
    setSaving(true);
    try {
      await store.updateSettings({
        cafeName: f.cafeName.trim(),
        phone: f.phone.trim(),
        whatsapp: f.whatsapp.replace(/\D/g, ""),
        acceptingOrders: f.acceptingOrders,
        slotMinutes: f.slotMinutes,
        hours: f.hours,
        socials: { instagram: f.instagram.trim(), facebook: f.facebook.trim() || null },
        delivery: { swiggy: f.swiggy.trim() || null, zomato: f.zomato.trim() || null },
      });
      toast.success("Settings saved");
    } catch (e) {
      toast.error(staffErrorCopy(e));
    } finally {
      setSaving(false);
    }
  };

  const input = "h-11 text-base";
  return (
    <form onSubmit={save} noValidate className="grid gap-6">
      <div className="grid gap-6 lg:grid-cols-2">
        <Card title="Café details">
          <Field id="s-cafeName" label="Café name" error={err("cafeName")}>
            <Input id="s-cafeName" className={input} value={f.cafeName} onChange={(e) => set("cafeName", e.target.value)} {...props("cafeName")} />
          </Field>
          <Field id="s-phone" label="Phone" error={err("phone")}>
            <Input id="s-phone" type="tel" className={input} value={f.phone} onChange={(e) => set("phone", e.target.value)} {...props("phone")} />
          </Field>
          <Field id="s-whatsapp" label="WhatsApp number" hint="Digits with country code, no plus sign." error={err("whatsapp")}>
            <Input id="s-whatsapp" inputMode="numeric" className={input} value={f.whatsapp} onChange={(e) => set("whatsapp", e.target.value)} {...props("whatsapp")} />
          </Field>
          <div className="grid gap-1">
            <p className="text-base font-bold">GST</p>
            <p className="text-base">5% (CGST 2.5% + SGST 2.5%)</p>
            <p className="text-sm text-muted-foreground">Fixed for this demo: prices are always calculated with 5% GST.</p>
          </div>
        </Card>

        <Card title="Online ordering">
          <div className="flex items-center justify-between gap-4 rounded-xl bg-muted p-4">
            <div>
              <Label htmlFor="s-accepting" className="text-base font-bold">Accepting online orders</Label>
              <p className="mt-1 text-sm text-muted-foreground">
                {f.acceptingOrders ? "Customers can order from the website." : "The menu stays visible, but /order shows “Not accepting online orders right now”."}
              </p>
            </div>
            <Switch id="s-accepting" checked={f.acceptingOrders} onCheckedChange={(v) => set("acceptingOrders", v)} aria-label="Accepting online orders" />
          </div>
          <Field id="s-slot" label="Takeaway slot length">
            <select
              id="s-slot"
              className="h-11 w-full rounded-lg border border-input bg-card px-3 text-base outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
              value={f.slotMinutes}
              onChange={(e) => set("slotMinutes", Number(e.target.value))}
            >
              {SLOTS.map((m) => (
                <option key={m} value={m}>
                  {m} minutes
                </option>
              ))}
            </select>
          </Field>
        </Card>
      </div>

      <Card title="Opening hours">
        <ul className="grid gap-3">
          {DISPLAY_ORDER.map((d) => (
            <li key={d} className="grid gap-1">
              <div className="grid grid-cols-[6.5rem_1fr_1fr] items-center gap-3 sm:grid-cols-[8rem_10rem_10rem]">
                <span className="font-bold">{DAYS[d]}</span>
                <Input type="time" aria-label={`${DAYS[d]} opens`} className={input} value={f.hours[d].open} onChange={(e) => setHours(d, "open", e.target.value)} aria-invalid={Boolean(showErrors && errors.hours[d]) || undefined} />
                <Input type="time" aria-label={`${DAYS[d]} closes`} className={input} value={f.hours[d].close} onChange={(e) => setHours(d, "close", e.target.value)} aria-invalid={Boolean(showErrors && errors.hours[d]) || undefined} />
              </div>
              {showErrors && errors.hours[d] && (
                <p role="alert" className="text-sm font-bold text-destructive-foreground">
                  {DAYS[d]}: {errors.hours[d]}
                </p>
              )}
            </li>
          ))}
        </ul>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card title="Social links">
          <Field id="s-instagram" label="Instagram" error={err("instagram")}>
            <Input id="s-instagram" type="url" className={input} value={f.instagram} onChange={(e) => set("instagram", e.target.value)} {...props("instagram")} />
          </Field>
          <Field id="s-facebook" label="Facebook (optional)" error={err("facebook")}>
            <Input id="s-facebook" type="url" className={input} value={f.facebook} onChange={(e) => set("facebook", e.target.value)} placeholder="https://" {...props("facebook")} />
          </Field>
        </Card>
        <Card title="Delivery apps">
          <Field id="s-swiggy" label="Swiggy (optional)" error={err("swiggy")}>
            <Input id="s-swiggy" type="url" className={input} value={f.swiggy} onChange={(e) => set("swiggy", e.target.value)} placeholder="https://" {...props("swiggy")} />
          </Field>
          <Field id="s-zomato" label="Zomato (optional)" error={err("zomato")}>
            <Input id="s-zomato" type="url" className={input} value={f.zomato} onChange={(e) => set("zomato", e.target.value)} placeholder="https://" {...props("zomato")} />
          </Field>
        </Card>
      </div>

      <div>
        <Button type="submit" className="h-12 px-6 text-base" disabled={saving}>
          {saving ? <Loader2 className="size-5 animate-spin motion-reduce:animate-none" aria-hidden="true" /> : <Save className="size-5" aria-hidden="true" />}
          Save settings
        </Button>
      </div>
    </form>
  );
}

export function SettingsForm() {
  const { data, error } = useLive("menu", (s) => s.getSettings());
  if (error) return <p role="alert">Couldn&apos;t load settings. Please refresh.</p>;
  if (!data) return <p role="status" className="text-muted-foreground">Loading settings…</p>;
  return <SettingsEditor initial={data} />;
}
