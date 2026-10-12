import type { MenuItem, MenuOption } from "@/data/menu";
import { dietOf, type Diet } from "@/lib/menu";

/** An option being edited; `id` is "" for options added in the editor (given a stable id on save). */
export type DraftOption = { key: string; id: string; group: string; label: string; priceDelta: string };
export type ItemDraft = {
  name: string;
  description: string;
  price: string;
  diet: Diet | "";
  bestseller: boolean;
  image: string | null;
  options: DraftOption[];
};

export const slug = (s: string) =>
  s
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

let keySeq = 0;
export const newKey = () => `k${++keySeq}`;

export function toDraft(item: MenuItem): ItemDraft {
  return {
    name: item.name,
    description: item.description ?? "",
    price: String(item.price),
    diet: dietOf(item) ?? "",
    bestseller: item.tags.includes("Bestseller"),
    image: item.image,
    options: item.options.map((o) => ({ key: newKey(), id: o.id, group: o.group, label: o.label, priceDelta: String(o.priceDelta) })),
  };
}

const DIET_FLAGS: Record<Diet | "", Pick<MenuItem, "veg" | "egg">> = {
  veg: { veg: true, egg: false },
  egg: { veg: true, egg: true },
  "non-veg": { veg: false, egg: false },
  "": { veg: null, egg: null },
};

const isInt = (s: string) => /^-?\d+$/.test(s.trim());

/** Returns the item to save, or the first thing wrong with the draft (shown as a toast). */
export function fromDraft(base: MenuItem, d: ItemDraft): { ok: true; item: MenuItem } | { ok: false; error: string } {
  const name = d.name.trim();
  if (!name) return { ok: false, error: "Give the dish a name." };
  if (!isInt(d.price) || Number(d.price) <= 0) return { ok: false, error: "Price must be a whole number of rupees above 0." };

  const used = new Set(d.options.map((o) => o.id).filter(Boolean));
  const seen = new Set<string>();
  const options: MenuOption[] = [];
  for (const o of d.options) {
    const group = o.group.trim();
    const label = o.label.trim();
    if (!group) return { ok: false, error: "Every option group needs a name." };
    if (!label) return { ok: false, error: `Give every option in "${group}" a label.` };
    if (!isInt(o.priceDelta)) return { ok: false, error: `The extra price for "${label}" must be a whole number (use 0 for none).` };
    const dupe = `${slug(group)}|${slug(label)}`;
    if (seen.has(dupe)) return { ok: false, error: `"${label}" appears twice in "${group}".` };
    seen.add(dupe);
    let id = o.id;
    if (!id) {
      const stem = `${base.id}--${slug(group)}-${slug(label)}`;
      id = stem;
      for (let n = 2; used.has(id); n++) id = `${stem}-${n}`;
      used.add(id);
    }
    options.push({ id, group, label, priceDelta: Number(o.priceDelta) });
  }

  const tags = base.tags.filter((t) => t !== "Bestseller");
  if (d.bestseller) tags.unshift("Bestseller");
  return {
    ok: true,
    item: {
      ...base,
      name,
      description: d.description.trim() || null,
      price: Number(d.price),
      ...DIET_FLAGS[d.diet],
      image: d.image,
      tags,
      options,
    },
  };
}
