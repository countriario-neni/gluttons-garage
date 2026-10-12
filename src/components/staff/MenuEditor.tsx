"use client";

import { useMemo, useState } from "react";
import { cn } from "cn";
import { Lock, Pencil, Plus, Search, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { DietMark } from "@/components/site/primitives/DietMark";
import { DishPlaceholder } from "@/components/site/primitives/DishPlaceholder";
import { Picture } from "@/components/site/primitives/Picture";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import type { MenuItem } from "@/data/menu";
import { formatINR } from "@/domain/money";
import { imageForSrc, siteImages } from "@/lib/images";
import { dietLabel, dietOf, filterMenu, type Diet } from "@/lib/menu";
import { useLive, useStore } from "@/store";
import { fromDraft, newKey, toDraft, type DraftOption, type ItemDraft } from "./menuDraft";
import { useStaffSession } from "./RequireStaff";

const ALL = "__all";
const pickable = siteImages.filter((i) => i.kind === "menu" || i.kind === "gallery");

function Thumb({ item, className }: { item: Pick<MenuItem, "image" | "name">; className?: string }) {
  const img = item.image ? imageForSrc(item.image) : undefined;
  return img ? (
    <Picture img={img} sizes="56px" className={cn("object-cover", className)} />
  ) : (
    <DishPlaceholder name={item.name} small className={className} />
  );
}

export function MenuEditor() {
  const { role } = useStaffSession();
  const owner = role === "owner";
  const { data, error, reload } = useLive("menu", (s) => s.getMenu());
  const store = useStore();
  const [cat, setCat] = useState(ALL);
  const [query, setQuery] = useState("");
  const [editing, setEditing] = useState<MenuItem | null>(null);

  const items = useMemo(() => data?.items ?? [], [data]);
  const categories = useMemo(() => [...(data?.categories ?? [])].sort((a, b) => a.sort - b.sort), [data]);
  const counts = useMemo(() => {
    const m = new Map<string, { total: number; sold: number }>();
    for (const i of items) {
      const c = m.get(i.categoryId) ?? { total: 0, sold: 0 };
      c.total++;
      if (!i.available) c.sold++;
      m.set(i.categoryId, c);
    }
    return m;
  }, [items]);

  const searching = query.trim().length > 0;
  const visible = useMemo(
    () => filterMenu(searching || cat === ALL ? items : items.filter((i) => i.categoryId === cat), { query }),
    [items, cat, query, searching],
  );
  const catName = (id: string) => categories.find((c) => c.id === id)?.name ?? id;

  async function setAvailable(item: MenuItem, available: boolean) {
    try {
      await store.setItemAvailability(item.id, available);
      toast.success(available ? `${item.name} is back on the menu` : `${item.name} marked sold out`);
    } catch {
      toast.error("Couldn't update that dish. Try again.");
      void reload();
    }
  }

  return (
    <>
      <header className="sticky top-0 z-30 flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-border bg-background/95 px-4 py-3 backdrop-blur sm:px-6">
        <h1 className="font-sans text-3xl font-extrabold tracking-tight">Menu</h1>
        <p className="text-base font-bold text-muted-foreground tabular-nums">
          {items.length} dishes · {items.filter((i) => !i.available).length} sold out
        </p>
        <div className="relative ml-auto w-full sm:w-72">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-5 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
          <Input
            type="search"
            role="searchbox"
            aria-label="Search dishes"
            placeholder="Search dishes"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="h-11 pl-10 text-base"
          />
        </div>
      </header>

      <main className="flex flex-1 flex-col gap-4 p-4 sm:p-6">
        {!owner && (
          <p className="flex items-center gap-2 rounded-xl border border-border bg-card px-4 py-3 text-base text-muted-foreground">
            <Lock className="size-5 shrink-0" aria-hidden="true" /> You can mark dishes sold out. Only the owner can edit details.
          </p>
        )}
        {error && !data ? (
          <p role="alert" className="rounded-2xl border border-border bg-card p-10 text-center text-xl font-bold">
            Couldn&apos;t load the menu.
          </p>
        ) : (
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start">
            <nav aria-label="Categories" className="lg:sticky lg:top-24 lg:w-64 lg:shrink-0">
              <ul className="flex gap-2 overflow-x-auto pb-1 lg:max-h-[calc(100dvh-8rem)] lg:flex-col lg:gap-1 lg:overflow-y-auto lg:overflow-x-hidden">
                {[{ id: ALL, name: "All dishes", n: items.length }, ...categories.map((c) => ({ id: c.id, name: c.name, n: counts.get(c.id)?.total ?? 0 }))].map((c) => {
                  const active = !searching && cat === c.id;
                  return (
                    <li key={c.id} className="shrink-0">
                      <button
                        type="button"
                        aria-pressed={active}
                        onClick={() => {
                          setCat(c.id);
                          setQuery("");
                        }}
                        className={cn(
                          "flex min-h-11 w-full items-center justify-between gap-3 rounded-xl px-3 text-left text-base font-bold whitespace-nowrap transition-colors",
                          active ? "bg-primary text-primary-foreground" : "bg-card text-muted-foreground hover:bg-muted hover:text-foreground",
                        )}
                      >
                        {c.name}
                        <span className="tabular-nums opacity-80">{c.n}</span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </nav>

            <section aria-label="Dishes" className="min-w-0 flex-1">
              <p className="mb-2 text-sm font-bold text-muted-foreground">
                {searching ? `Results for “${query.trim()}”` : cat === ALL ? "All dishes" : catName(cat)} · {visible.length}
              </p>
              {!data ? (
                <p role="status" className="p-10 text-center text-lg text-muted-foreground">Loading the menu…</p>
              ) : visible.length === 0 ? (
                <p className="rounded-2xl border border-border bg-card p-10 text-center text-lg text-muted-foreground">No dishes match.</p>
              ) : (
                <ul className="divide-y divide-border overflow-hidden rounded-2xl border border-border bg-card">
                  {visible.map((i) => {
                    const diet = dietOf(i);
                    return (
                      <li key={i.id} data-item={i.id} data-available={i.available} className="flex items-center gap-3 p-3 sm:gap-4">
                        <Thumb item={i} className="size-14 shrink-0 overflow-hidden rounded-lg" />
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                            {diet && <DietMark diet={diet} />}
                            <h2 className="min-w-0 text-base font-bold text-foreground">{i.name}</h2>
                            {i.tags.map((t) => (
                              <span key={t} className="rounded-full bg-accent px-2 py-0.5 text-xs font-bold text-accent-foreground">
                                {t}
                              </span>
                            ))}
                          </div>
                          <p className="text-sm text-muted-foreground">
                            {searching || cat === ALL ? `${catName(i.categoryId)} · ` : ""}
                            {i.options.length > 0 ? `${i.options.length} options` : "No options"}
                          </p>
                        </div>
                        <p className="font-bold tabular-nums">{formatINR(i.price)}</p>
                        <label className="flex min-h-11 items-center gap-2 text-sm font-bold">
                          <Switch
                            aria-label={`${i.name} available`}
                            checked={i.available}
                            onCheckedChange={(v) => void setAvailable(i, v)}
                          />
                          <span className={cn("hidden w-16 sm:inline", i.available ? "text-success" : "text-muted-foreground")}>
                            {i.available ? "Available" : "Sold out"}
                          </span>
                        </label>
                        {owner && (
                          <Button variant="outline" size="icon" aria-label={`Edit ${i.name}`} onClick={() => setEditing(i)}>
                            <Pencil className="size-5" aria-hidden="true" />
                          </Button>
                        )}
                      </li>
                    );
                  })}
                </ul>
              )}
            </section>
          </div>
        )}
      </main>

      {owner && <EditSheet item={editing} onClose={() => setEditing(null)} />}
    </>
  );
}

function EditSheet({ item, onClose }: { item: MenuItem | null; onClose: () => void }) {
  return (
    <Sheet open={item !== null} onOpenChange={(o) => !o && onClose()}>
      <SheetContent className="theme-kitchen w-full gap-0 data-[side=right]:sm:max-w-xl" aria-label="Edit dish">
        {item && <EditForm key={item.id} item={item} onClose={onClose} />}
      </SheetContent>
    </Sheet>
  );
}

const DIETS: { value: Diet | ""; label: string }[] = [
  { value: "veg", label: dietLabel.veg },
  { value: "egg", label: dietLabel.egg },
  { value: "non-veg", label: dietLabel["non-veg"] },
  { value: "", label: "Not marked" },
];

function EditForm({ item, onClose }: { item: MenuItem; onClose: () => void }) {
  const store = useStore();
  const [d, setD] = useState<ItemDraft>(() => toDraft(item));
  const [saving, setSaving] = useState(false);
  const set = <K extends keyof ItemDraft>(k: K, v: ItemDraft[K]) => setD((p) => ({ ...p, [k]: v }));
  const setOpt = (key: string, patch: Partial<DraftOption>) =>
    setD((p) => ({ ...p, options: p.options.map((o) => (o.key === key ? { ...o, ...patch } : o)) }));
  const groups = [...new Set(d.options.map((o) => o.group))];

  async function save() {
    const r = fromDraft(item, d);
    if (!r.ok) return void toast.error(r.error);
    setSaving(true);
    try {
      await store.upsertItem(r.item);
      toast.success(`${r.item.name} saved`);
      onClose();
    } catch {
      toast.error("Couldn't save. Are you signed in as the owner?");
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <SheetHeader className="border-b border-border p-5">
        <SheetTitle className="text-2xl font-bold">Edit dish</SheetTitle>
        <SheetDescription className="text-base">Changes show on the public menu straight away.</SheetDescription>
      </SheetHeader>
      <div className="flex-1 space-y-6 overflow-y-auto p-5">
        <div className="space-y-2">
          <Label htmlFor="mi-name" className="text-base font-bold">Name</Label>
          <Input id="mi-name" className="h-12 text-base" value={d.name} onChange={(e) => set("name", e.target.value)} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="mi-desc" className="text-base font-bold">Description</Label>
          <Textarea id="mi-desc" className="text-base" value={d.description} onChange={(e) => set("description", e.target.value)} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="mi-price" className="text-base font-bold">Price (₹)</Label>
          <Input id="mi-price" inputMode="numeric" className="h-12 w-40 text-base tabular-nums" value={d.price} onChange={(e) => set("price", e.target.value)} />
        </div>

        <fieldset className="space-y-2">
          <legend className="text-base font-bold">Diet</legend>
          <div className="flex flex-wrap gap-2">
            {DIETS.map((o) => (
              <button
                key={o.value || "none"}
                type="button"
                aria-pressed={d.diet === o.value}
                onClick={() => set("diet", o.value)}
                className={cn(
                  "min-h-11 rounded-full border px-4 text-base font-bold transition-colors",
                  d.diet === o.value ? "border-primary bg-primary text-primary-foreground" : "border-border hover:bg-muted",
                )}
              >
                {o.label}
              </button>
            ))}
          </div>
        </fieldset>

        <label className="flex min-h-11 items-center justify-between gap-3 text-base font-bold">
          Bestseller tag
          <Switch aria-label="Bestseller" checked={d.bestseller} onCheckedChange={(v) => set("bestseller", v)} />
        </label>

        <fieldset className="space-y-2">
          <legend className="text-base font-bold">Photo</legend>
          <div className="grid max-h-60 grid-cols-4 gap-2 overflow-y-auto rounded-xl border border-border p-2 sm:grid-cols-5">
            <button
              type="button"
              aria-pressed={d.image === null}
              onClick={() => set("image", null)}
              className={cn(
                "grid aspect-square place-items-center rounded-lg border-2 text-sm font-bold",
                d.image === null ? "border-primary text-primary" : "border-border text-muted-foreground",
              )}
            >
              No photo
            </button>
            {pickable.map((img) => (
              <button
                key={img.slug}
                type="button"
                aria-label={img.alt}
                aria-pressed={d.image === img.src640}
                onClick={() => set("image", img.src640)}
                className={cn(
                  "aspect-square overflow-hidden rounded-lg border-2",
                  d.image === img.src640 ? "border-primary" : "border-transparent hover:border-border",
                )}
              >
                <Picture img={{ ...img, alt: "" }} sizes="96px" className="size-full object-cover" />
              </button>
            ))}
          </div>
        </fieldset>

        <section className="space-y-3" aria-label="Options">
          <h3 className="text-base font-bold">Options</h3>
          {groups.length === 0 && <p className="text-sm text-muted-foreground">No options. Guests add this dish with one tap.</p>}
          {groups.map((g) => (
            <div key={g} className="space-y-2 rounded-xl border border-border p-3">
              <Input
                aria-label="Group name"
                className="h-11 text-base font-bold"
                value={g}
                onChange={(e) => setD((p) => ({ ...p, options: p.options.map((o) => (o.group === g ? { ...o, group: e.target.value } : o)) }))}
              />
              {d.options
                .filter((o) => o.group === g)
                .map((o) => (
                  <div key={o.key} className="flex flex-wrap items-center gap-2">
                    <Input aria-label="Option label" className="h-11 min-w-0 basis-full text-base sm:flex-1 sm:basis-0" value={o.label} onChange={(e) => setOpt(o.key, { label: e.target.value })} />
                    <span className="text-sm text-muted-foreground">+₹</span>
                    <Input
                      aria-label="Extra price"
                      inputMode="numeric"
                      className="h-11 w-20 text-base tabular-nums"
                      value={o.priceDelta}
                      onChange={(e) => setOpt(o.key, { priceDelta: e.target.value })}
                    />
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label={`Remove option ${o.label || ""}`.trim()}
                      onClick={() => setD((p) => ({ ...p, options: p.options.filter((x) => x.key !== o.key) }))}
                    >
                      <Trash2 className="size-5" aria-hidden="true" />
                    </Button>
                  </div>
                ))}
              <Button
                variant="secondary"
                onClick={() => setD((p) => ({ ...p, options: [...p.options, { key: newKey(), id: "", group: g, label: "", priceDelta: "0" }] }))}
              >
                <Plus aria-hidden="true" /> Add option to {g || "group"}
              </Button>
            </div>
          ))}
          <Button
            variant="outline"
            onClick={() =>
              setD((p) => ({ ...p, options: [...p.options, { key: newKey(), id: "", group: `Group ${groups.length + 1}`, label: "", priceDelta: "0" }] }))
            }
          >
            <Plus aria-hidden="true" /> Add option group
          </Button>
        </section>
      </div>
      <SheetFooter className="flex-row justify-end gap-3 border-t border-border p-4">
        <Button variant="outline" size="lg" disabled={saving} onClick={onClose}>
          Cancel
        </Button>
        <Button size="lg" disabled={saving} onClick={() => void save()}>
          Save changes
        </Button>
      </SheetFooter>
    </>
  );
}
