import { describe, expect, test } from "vitest";
import { items, type MenuItem } from "@/data/menu";
import { dietOf, filterMenu, guestFavourites } from "@/lib/menu";
import { imageBySlug, imageForSrc, siteImages } from "@/lib/images";
import { cafeNow } from "@/lib/time";

const item = (p: Partial<MenuItem>): MenuItem => ({
  id: "x",
  categoryId: "c",
  name: "X",
  description: null,
  price: 100,
  veg: null,
  egg: null,
  image: null,
  tags: [],
  options: [],
  available: true,
  ...p,
});

describe("dietOf", () => {
  test.each([
    [{ veg: true, egg: null }, "veg"],
    [{ veg: true, egg: false }, "veg"],
    [{ veg: true, egg: true }, "egg"],
    [{ veg: null, egg: true }, "egg"],
    [{ veg: false, egg: true }, "non-veg"],
    [{ veg: false, egg: null }, "non-veg"],
    [{ veg: null, egg: null }, null],
  ] as const)("%o -> %s", (flags, want) => {
    expect(dietOf(flags)).toBe(want);
  });
});

describe("filterMenu", () => {
  const list = [
    item({ id: "a", name: "Nutella Pancakes", description: "Fluffy", veg: true }),
    item({ id: "b", name: "Chicken Wrap", description: "Grilled chicken in wheat", veg: false }),
    item({ id: "c", name: "Plain Omelette", egg: true }),
  ];
  test("empty query keeps everything", () => expect(filterMenu(list, {})).toHaveLength(3));
  test("every word must match name or description, any case", () => {
    expect(filterMenu(list, { query: "WHEAT chicken" }).map((i) => i.id)).toEqual(["b"]);
    expect(filterMenu(list, { query: "chicken pancakes" })).toEqual([]);
  });
  test("veg only excludes egg, non-veg and unknown", () => {
    expect(filterMenu(list, { vegOnly: true }).map((i) => i.id)).toEqual(["a"]);
  });
});

test("guestFavourites: pictured bestsellers, other photos, then unpictured bestsellers, no duplicates", () => {
  const favs = guestFavourites(items);
  const rank = (i: MenuItem) => (i.image ? (i.tags.includes("Bestseller") ? 0 : 1) : 2);
  const ranks = favs.map(rank);
  expect(ranks).toEqual([...ranks].sort((x, y) => x - y));
  expect(favs.every((i) => i.image || i.tags.includes("Bestseller"))).toBe(true);
  expect(favs).toHaveLength(items.filter((i) => i.image || i.tags.includes("Bestseller")).length);
  expect(new Set(favs.map((i) => i.id)).size).toBe(favs.length);
});

test("every menu image resolves to a manifest entry", () => {
  for (const i of items) if (i.image) expect(imageForSrc(i.image)).toBeDefined();
  expect(imageBySlug(siteImages[0].slug)).toBe(siteImages[0]);
  expect(() => imageBySlug("nope")).toThrow();
});

test("cafeNow reads IST wall-clock time regardless of the visitor's zone", () => {
  // 2026-10-12 03:00 UTC is 08:30 IST on a Monday.
  const ist = cafeNow(new Date(Date.UTC(2026, 9, 12, 3, 0)));
  expect([ist.getDay(), ist.getHours(), ist.getMinutes()]).toEqual([1, 8, 30]);
});
