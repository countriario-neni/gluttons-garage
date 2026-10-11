// Turns the selected source photos in research/raw into optimised webp files
// under public/images/{hero,gallery,menu,about} and writes public/images/manifest.json.
// Run: npm run images:build   (research/raw is git-ignored; outputs are committed)
import { createRequire } from "node:module";
import { readFileSync, writeFileSync, mkdirSync, rmSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const sharp = require("sharp");
const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const raw = join(root, "research", "raw");
const out = join(root, "public", "images");

// Per-file slug, alt text and optional crop (fractions of the source).
// Crops remove the studio logo watermark (top-left) or unrelated third-party branding.
const WM = { top: 0.23 }; // logo occupies the top-left ~20% x 22% of the 3:2 studio shots
const SPEC = {
  "photo-21.jpg": { slug: "dining-room-checkerboard-floor", alt: "Gluttons Garage dining room with rust velvet tub chairs and a black-and-cream checkerboard floor" },
  "photo-22.jpg": { slug: "bbq-grilled-paneer-steaks", alt: "Char-grilled paneer rounds glazed in BBQ sauce on a white plate" },
  "photo-23.jpg": { slug: "storefront-daytime", alt: "Gluttons Garage storefront by day with white 3D letters on a black fascia" },
  "photo-24.jpg": { slug: "pasta-bolognese-pappardelle", alt: "Ribbon pasta in meat ragu topped with grated parmesan" },
  "photo-25.jpg": { slug: "bbq-grilled-paneer-steaks-alt", alt: "BBQ-glazed grilled paneer rounds with sauce lines on a white serving plate" },
  "photo-26.jpg": { slug: "choco-cereal-bowl", alt: "Bowl of chocolate cereal in milk topped with pomegranate and orange", crop: WM },
  "photo-27.jpg": { slug: "crumb-fried-devilled-eggs", alt: "Four crumb-fried devilled egg halves with chilli flakes and herbs", crop: { top: 0.2 } },
  "photo-28.jpg": { slug: "chicken-samosa-with-chips", alt: "Broken-open meat-filled samosa served with potato chips and a dip", crop: WM },
  "photo-29.jpg": { slug: "chicken-cheese-croquettes", alt: "Five crumb-fried chicken cheese balls topped with olive rings and a mayo drizzle", crop: { top: 0.26 } },
  "photo-30.jpg": { slug: "egg-crepe-broccoli-wrap", alt: "Folded egg crepes stuffed with broccoli, peppers and sausage", crop: { left: 0.21 } },
  "photo-31.jpg": { slug: "grilled-quesadilla-and-chicken-salad", alt: "Grilled quesadilla wedges with chips beside a creamy chicken salad with croutons" },
  "photo-32.jpg": { slug: "egg-crepe-sriracha", alt: "Folded crepe filled with scrambled egg and finished with sriracha stripes", crop: WM },
  "photo-33.jpg": { slug: "grilled-egg-cheese-sandwich", alt: "Panini-grilled egg and cheese sandwich with fries and a dip", crop: WM },
  "photo-34.jpg": { slug: "cornflakes-with-milk", alt: "Bowl of cornflakes with pomegranate and almonds beside a glass of milk", crop: { top: 0.17 } },
  "photo-37.jpg": { slug: "cheese-garlic-pizza", alt: "Sliced cheese garlic pizza with chilli flakes", crop: WM },
  "photo-38.jpg": { slug: "bbq-chicken-pizza-and-fish-fingers", alt: "BBQ chicken pizza with olives and peppers beside crumb-fried fish fingers and chips" },
  "yappe-109699.webp": { slug: "storefront-night", alt: "Gluttons Garage storefront at night with warm-lit letters and a vintage motorcycle", crop: { height: 0.44 } },
  "yappe-689582.webp": { slug: "dining-room-gear-mural", alt: "Dining room with a black-and-white gear mural, tub chairs and checkerboard floor" },
  "yappe-689584.webp": { slug: "herbed-potato-wedges", alt: "Herbed potato wedges with a ramekin of tangy BBQ sauce" },
  "yappe-689588.webp": { slug: "chettinad-chicken-tenders", alt: "Spiced grilled chicken tenders with onion rings, lime and a peanut dip" },
  "yappe-689589.webp": { slug: "dessert-counter", alt: "Dessert counter with tiramisu, cheesecake, brownies, cupcakes and muffins" },
  "yappe-689591.webp": { slug: "vanilla-milkshake", alt: "Thick vanilla milkshake in a glass bottle with a paper straw" },
  "yappe-689592.webp": { slug: "logo-mural", alt: "Painted wall mural of the Gluttons Garage logo with the words Fusion Happens" },
  "yappe-689593.webp": { slug: "broccoli-cheese-pizza", alt: "Creamy broccoli and cheese pizza in front of the gear mural wall" },
  "yappe-689595.webp": { slug: "chicken-salad-croutons-closeup", alt: "Close-up of golden croutons over a creamy chicken salad" },
  "yappe-689596.webp": { slug: "chicken-salad-croutons", alt: "Bowl of creamy chicken salad with croutons on a glass table" },
};
const DIRS = { hero: "hero", "menu-card": "menu", gallery: "gallery", about: "about" };

const photos = JSON.parse(readFileSync(join(root, "research", "photos.json"), "utf8"));
const selected = photos.filter(
  (p) => DIRS[p.use_for] && p.quality >= 3 && p.contains_people_faces === false,
);

rmSync(out, { recursive: true, force: true });
for (const d of Object.values(DIRS)) mkdirSync(join(out, d), { recursive: true });

const manifest = [];
for (const p of selected) {
  const spec = SPEC[p.file];
  if (!spec) throw new Error(`No slug/alt/crop spec for selected photo ${p.file}; add it to SPEC`);
  const kind = DIRS[p.use_for];
  const input = join(raw, p.file);
  const meta = await sharp(input).metadata();
  const c = spec.crop ?? {};
  const left = Math.round((c.left ?? 0) * meta.width);
  const top = Math.round((c.top ?? 0) * meta.height);
  const region = {
    left,
    top,
    width: Math.round((c.width ?? 1) * meta.width) - left,
    height: Math.round((c.height ?? 1) * meta.height) - top,
  };
  const entry = { slug: spec.slug, kind, src640: "", src1280: "", alt: spec.alt, width: 0, height: 0 };
  for (const w of [640, 1280]) {
    const rel = `/images/${kind}/${spec.slug}-${w}.webp`;
    const info = await sharp(input)
      .rotate()
      .extract(region)
      .resize({ width: w, withoutEnlargement: true })
      .webp({ quality: 78 })
      .toFile(join(root, "public", rel));
    entry[`src${w}`] = rel;
    if (w === 1280) {
      entry.width = info.width;
      entry.height = info.height;
    }
  }
  // dish is used by build-menu.mjs to fuzzy-match photos to menu items
  entry.dish = ["food", "dessert", "drink"].includes(p.type) && p.dish_guess && !/counter/.test(p.dish_guess) ? p.dish_guess : null;
  manifest.push(entry);
}
writeFileSync(join(out, "manifest.json"), JSON.stringify(manifest, null, 2) + "\n");
console.log(`wrote ${manifest.length} images (x2 widths) + manifest.json`);
