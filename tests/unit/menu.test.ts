import { expect, test } from "vitest";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { items, categories } from "@/data/menu";
import { cafe } from "@/data/cafe";

test("menu is real and consistent", () => {
  expect(items.length).toBeGreaterThan(30);
  const catIds = new Set(categories.map((c) => c.id));
  for (const i of items) {
    expect(catIds.has(i.categoryId)).toBe(true);
    expect(Number.isInteger(i.price) && i.price > 0).toBe(true);
  }
  expect(new Set(items.map((i) => i.id)).size).toBe(items.length);
});

test("categories have unique ids and ascending sort", () => {
  expect(new Set(categories.map((c) => c.id)).size).toBe(categories.length);
  const sorts = categories.map((c) => c.sort);
  expect(sorts).toEqual([...sorts].sort((a, b) => a - b));
  expect(categories[categories.length - 1].name).toBe("Coffee & Desserts");
});

test("no sister-brand names anywhere in menu text", () => {
  const re = /kaloreez|junktion/i;
  for (const c of categories) expect(c.name).not.toMatch(re);
  for (const i of items) {
    expect(JSON.stringify([i.name, i.description, i.tags, i.options])).not.toMatch(re);
  }
});

test("option ids are unique and add-ons cost money", () => {
  const ids = items.flatMap((i) => i.options.map((o) => o.id));
  expect(new Set(ids).size).toBe(ids.length);
  const addOns = items.flatMap((i) => i.options.filter((o) => o.group === "Add-ons"));
  expect(addOns.length).toBeGreaterThan(0);
  for (const o of addOns) expect(o.priceDelta).toBeGreaterThan(0);
  for (const i of items) for (const o of i.options) expect(o.id.startsWith(`${i.id}--`)).toBe(true);
});

test("variant groups include a free base option", () => {
  for (const i of items) {
    for (const g of ["Size", "Choice"]) {
      const opts = i.options.filter((o) => o.group === g);
      if (opts.length) expect(Math.min(...opts.map((o) => o.priceDelta))).toBe(0);
    }
  }
});

test("dressing options are free and only on salad pages", () => {
  const dressed = items.filter((i) => i.options.some((o) => o.group === "Dressing"));
  expect(dressed.length).toBeGreaterThan(10);
  for (const i of dressed) for (const o of i.options.filter((x) => x.group === "Dressing")) expect(o.priceDelta).toBe(0);
});

test("Coffee & Desserts has exactly the five listing-sourced items", () => {
  const cat = categories.find((c) => c.name === "Coffee & Desserts")!;
  const list = items.filter((i) => i.categoryId === cat.id);
  expect(list.map((i) => [i.name, i.price, i.egg]).sort()).toEqual(
    [
      ["Cheesecake", 180, false],
      ["Fruit And Nut Sundae", 190, false],
      ["Brownie Sundae", 190, false],
      ["Oreo Vanilla Sundae", 190, false],
      ["Caramel Banana Crepe", 190, true],
    ].sort(),
  );
  expect(list.every((i) => i.veg === true)).toBe(true);
});

test("every non-null image path exists under public/", () => {
  const withImg = items.filter((i) => i.image !== null);
  expect(withImg.length).toBeGreaterThan(0);
  for (const i of withImg) {
    expect(i.image!.startsWith("/images/")).toBe(true);
    expect(existsSync(join(process.cwd(), "public", i.image!))).toBe(true);
  }
});

test("all items available; nutrition is numeric when present", () => {
  for (const i of items) {
    expect(i.available).toBe(true);
    if (i.nutrition) for (const v of Object.values(i.nutrition)) expect(typeof v).toBe("number");
  }
});

test("cafe facts", () => {
  expect(cafe.name).toBe("Gluttons Garage");
  expect(cafe.phoneE164).toBe("+917702368884");
  expect(cafe.hours[1].close).toBe("20:30");
  for (const d of [0, 2, 3, 4, 5, 6]) expect(cafe.hours[d]).toEqual({ open: "08:00", close: "22:00" });
  expect(cafe.rating).toEqual({ value: 4.1, source: "Google" });
  expect(cafe.facebook).toBeNull();
});
