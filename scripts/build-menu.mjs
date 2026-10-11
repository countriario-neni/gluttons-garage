// Builds src/data/menu.ts from the printed-menu transcriptions in research/menu/*.json
// and the image manifest written by process-images.mjs (run `npm run images:build` first).
// Run: npm run menu:build
import { readFileSync, writeFileSync, readdirSync, existsSync, mkdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const menuDir = join(root, "research", "menu");

const BRAND = /kaloreez|junktion\s?77|junktion/gi;
const clean = (s) => (s == null ? null : s.replace(BRAND, "").replace(/\s+/g, " ").trim() || null);
const slug = (s) =>
  s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/['’]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60)
    .replace(/-+$/, "");
const titleCaseIfShouting = (s) =>
  s === s.toUpperCase() && /[A-Z]{3}/.test(s) ? s.toLowerCase().replace(/\b[a-z]/g, (c) => c.toUpperCase()) : s;

const isToppings = (n) => /^toppings?$/i.test(n.trim());
const isDressing = (n) => /dressing/i.test(n);
const specialTag = (n) => (/^GG Special/.test(n) ? "GG Special" : /^Twisted/.test(n) ? "Twisted" : null);
const isSize = (labels) => labels.every((l) => /^(regular|large|small|medium|r|l|s|m)$/i.test(l.trim()));

function nutrition(n) {
  if (!n) return undefined;
  const find = (re) => Object.entries(n).find(([k]) => re.test(k))?.[1];
  const v = { kcal: find(/kcal|calor/i), fat: find(/fat/i), carbs: find(/carb/i), protein: find(/prot/i) };
  if (Object.values(v).some((x) => typeof x !== "number")) return undefined;
  for (const k of Object.keys(v)) v[k] = Math.round(v[k] * 10) / 10;
  return v;
}

const categories = [];
const items = [];
const usedItemIds = new Set();

const pages = readdirSync(menuDir)
  .filter((f) => /^menu-\d+\.json$/.test(f))
  .sort()
  .map((f) => ({ file: f, ...JSON.parse(readFileSync(join(menuDir, f), "utf8")) }))
  .filter((p) => p.kind === "menu_page");

for (const page of pages) {
  const toppings = [];
  const dressings = [];
  const sections = [];
  for (const s of page.sections) {
    if (isToppings(s.section)) {
      for (const t of s.items) if (!t.uncertain && t.price > 0) toppings.push({ label: clean(t.name), price: t.price });
    } else if (isDressing(s.section)) {
      for (const d of s.items) if (!d.uncertain) dressings.push(clean(d.name));
    } else sections.push(s);
  }
  const main = sections.find((s) => !specialTag(s.section));
  if (!main) throw new Error(`${page.file}: no main section`);
  const mainName = clean(main.section);

  const catFor = (name) => {
    const id = slug(name);
    let c = categories.find((x) => x.id === id);
    if (!c) {
      c = { id, name, sort: categories.length };
      categories.push(c);
    }
    return c;
  };

  for (const s of sections) {
    const tag = specialTag(s.section);
    const cat = catFor(tag ? mainName : clean(s.section));
    for (const raw of s.items) {
      if (raw.uncertain || !(raw.price > 0)) continue;
      const name = titleCaseIfShouting(clean(raw.name));
      let id = `${cat.id}-${slug(name)}`;
      for (let n = 2; usedItemIds.has(id); n++) id = `${cat.id}-${slug(name)}-${n}`;
      usedItemIds.add(id);

      const options = [];
      const optIds = new Set();
      const addOpt = (group, label, priceDelta) => {
        let oid = `${id}--${slug(group)}-${slug(label)}`;
        for (let n = 2; optIds.has(oid); n++) oid = `${id}--${slug(group)}-${slug(label)}-${n}`;
        optIds.add(oid);
        options.push({ id: oid, group, label, priceDelta });
      };

      let price = raw.price;
      const variants = (raw.variants ?? []).filter((v) => v.price > 0);
      if (variants.length >= 2) {
        price = Math.min(...variants.map((v) => v.price));
        const labels = variants.map((v) => clean(v.label));
        const group = isSize(labels) ? "Size" : "Choice";
        variants.forEach((v, i) => addOpt(group, labels[i], v.price - price));
      }
      if (!Number.isInteger(price)) throw new Error(`${page.file}: non-integer price for ${name}`);
      for (const d of dressings) addOpt("Dressing", d, 0);
      for (const t of toppings) addOpt("Add-ons", t.label, t.price);

      const item = {
        id,
        categoryId: cat.id,
        name,
        description: clean(raw.description),
        price,
        veg: raw.veg ?? null,
        egg: raw.egg ?? null,
        image: null,
        tags: tag ? [tag] : [],
        options,
        available: true,
      };
      const nut = nutrition(raw.nutrition);
      if (nut) item.nutrition = nut;
      items.push(item);
    }
  }
}

// Listing-sourced items (magicpin), added as the final category.
const dessertCat = { id: "coffee-desserts", name: "Coffee & Desserts", sort: categories.length };
categories.push(dessertCat);
for (const [name, price, description, egg] of [
  ["Cheesecake", 180, "New York style cheesecake topped with berries", false],
  ["Fruit And Nut Sundae", 190, null, false],
  ["Brownie Sundae", 190, null, false],
  ["Oreo Vanilla Sundae", 190, null, false],
  ["Caramel Banana Crepe", 190, null, true],
]) {
  items.push({
    id: `${dessertCat.id}-${slug(name)}`,
    categoryId: dessertCat.id,
    name,
    description,
    price,
    veg: true,
    egg,
    image: null,
    tags: [],
    options: [],
    available: true,
  });
}

// Bestseller tag: dishes praised in public reviews (all key tokens must appear in the name).
const stem = (t) => t.replace(/(?<!s)s$/, "");
const toks = (s) => s.toLowerCase().split(/[^a-z0-9]+/).filter(Boolean).map(stem);
const BEST = [
  ["Tiramisu French Toast", ["tiramisu", "french", "toast"]],
  ["Japanese Honey Toast", ["japanese", "honey", "toast"]],
  ["Nutella Pancake", ["nutella", "pancake"]],
  ["Peri Peri (fries/Maggi)", ["peri", "peri"], /fries|maa?gi|noodle/i],
  ["Broccoli Pizza", ["broccoli", "pizza"]],
  ["Alfredo Pasta", ["alfredo", "pasta"]],
  ["Basil Pesto Pasta", ["basil", "pesto", "pasta"]],
  ["Crab Meat Burger", ["crab", "meat", "burger"]],
  ["Mushroom cream soup", ["mushroom", "cream", "soup"]],
  ["Spinach Omelette", ["spinach", "omelette"]],
  ["Potato Wedges", ["potato", "wedge"]],
];
const bestMatches = [];
for (const [label, need, extra] of BEST) {
  for (const it of items) {
    const t = toks(it.name.replace(/omelet\b/i, "omelette").replace(/omlette/i, "omelette"));
    if (need.every((n) => t.includes(n)) && (!extra || extra.test(it.name))) {
      if (!it.tags.includes("Bestseller")) it.tags.push("Bestseller");
      bestMatches.push(`${label} -> ${it.id}`);
    }
  }
}

const manifestPath = join(root, "public", "images", "manifest.json");
const manifest = existsSync(manifestPath) ? JSON.parse(readFileSync(manifestPath, "utf8")) : [];

// Images: fuzzy-match each manifest photo's dish to item names (token overlap >= 0.6).
// Guards keep the match honest: head noun must agree, protein words must not conflict,
// meat photos never go on veg items, and each photo is used for at most one item.
const STOP = new Set(["and", "with", "the", "of", "no", "nos", "a"]);
const PROTEINS = ["chicken", "paneer", "fish", "egg", "tuna", "lamb", "mutton", "prawn", "tofu", "mushroom", "bacon", "sausage", "crab"];
const MEAT = ["chicken", "fish", "tuna", "lamb", "mutton", "prawn", "bacon", "sausage", "crab", "egg"];
const tokList = (s) =>
  toks(
    s
      .replace(/corn flakes/gi, "cornflakes")
      .replace(/devilled/gi, "deviled")
      .replace(/panner/gi, "paneer"),
  ).filter((t) => !STOP.has(t));
const phraseVariants = (s, isItem) => {
  const base = isItem ? s.replace(/\(.*?\)/g, " ").split(" - ")[0] : s;
  return base
    .split("/")
    .map((p) => p.split(/\bwith\b/i)[0])
    .map(tokList)
    .filter((x) => x.length);
};
const matchScore = (d, n) => {
  const ds = new Set(d);
  const ns = new Set(n);
  const inter = [...ds].filter((t) => ns.has(t)).length;
  const min = Math.min(ds.size, ns.size);
  if (inter === 0) return 0;
  if (min < 2 && !(ds.size === ns.size && inter === ds.size)) return 0;
  if (!ns.has(d[d.length - 1])) return 0; // head noun of the photo's dish must be in the item name
  const dp = PROTEINS.filter((x) => ds.has(x));
  const np = PROTEINS.filter((x) => ns.has(x));
  if (dp.length && np.length && !dp.some((x) => np.includes(x))) return 0;
  return inter / min;
};
const candidates = [];
for (const it of items) {
  const names = phraseVariants(it.name, true);
  for (const m of manifest) {
    if (!m.dish) continue;
    if (it.veg === true && MEAT.some((x) => tokList(m.dish).includes(x))) continue;
    let sc = 0;
    for (const d of phraseVariants(m.dish, false)) for (const n of names) sc = Math.max(sc, matchScore(d, n));
    if (sc >= 0.6) candidates.push({ it, m, sc });
  }
}
candidates.sort((x, y) => y.sc - x.sc);
const usedPhotos = new Set();
const imageMatches = [];
for (const { it, m, sc } of candidates) {
  if (it.image || usedPhotos.has(m.slug)) continue;
  it.image = m.src640;
  usedPhotos.add(m.slug);
  imageMatches.push(`${it.id} <- ${m.slug} (${sc.toFixed(2)})`);
}

const ts = `// GENERATED by scripts/build-menu.mjs, do not edit.
// Source: research/menu/*.json (printed menu transcriptions) + public/images/manifest.json.
// Regenerate with: npm run images:build && npm run menu:build

export type MenuOption = { id: string; group: string; label: string; priceDelta: number };
export type MenuItem = {
  id: string;
  categoryId: string;
  name: string;
  description: string | null;
  price: number;
  veg: boolean | null;
  egg: boolean | null;
  image: string | null;
  tags: string[];
  options: MenuOption[];
  available: boolean;
  nutrition?: { kcal: number; fat: number; carbs: number; protein: number };
};
export type MenuCategory = { id: string; name: string; sort: number };

export const categories: MenuCategory[] = ${JSON.stringify(categories, null, 2)};

export const items: MenuItem[] = ${JSON.stringify(items, null, 2)};
`;
mkdirSync(join(root, "src", "data"), { recursive: true });
writeFileSync(join(root, "src", "data", "menu.ts"), ts);

const optCount = items.reduce((n, i) => n + i.options.length, 0);
console.log(`categories=${categories.length} items=${items.length} options=${optCount} withImage=${items.filter((i) => i.image).length}`);
console.log("bestsellers:\n  " + (bestMatches.join("\n  ") || "none"));
console.log("images:\n  " + (imageMatches.join("\n  ") || "none"));
for (const c of categories) console.log(`${c.sort}\t${c.id}\t${items.filter((i) => i.categoryId === c.id).length}`);
