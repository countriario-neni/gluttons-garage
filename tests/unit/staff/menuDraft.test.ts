import { describe, expect, it } from "vitest";
import { items } from "@/data/menu";
import { fromDraft, newKey, toDraft } from "@/components/staff/menuDraft";

const withOptions = items.find((i) => i.options.length > 0)!;
const plainItem = items.find((i) => i.options.length === 0)!;

describe("menuDraft", () => {
  it("round-trips an item unchanged", () => {
    const r = fromDraft(withOptions, toDraft(withOptions));
    expect(r.ok && r.item.options).toEqual(withOptions.options);
    expect(r.ok && r.item.price).toBe(withOptions.price);
  });

  it("rejects bad prices and empty names", () => {
    for (const price of ["0", "-5", "12.5", "abc", ""]) {
      expect(fromDraft(plainItem, { ...toDraft(plainItem), price }).ok).toBe(false);
    }
    expect(fromDraft(plainItem, { ...toDraft(plainItem), name: "  " }).ok).toBe(false);
  });

  it("gives new options unique ids and keeps existing ones", () => {
    const d = toDraft(withOptions);
    const first = withOptions.options[0];
    d.options.push(
      { key: newKey(), groupKey: newKey(), id: "", group: "Spice", label: "Hot", priceDelta: "5" },
      { key: newKey(), groupKey: newKey(), id: `${withOptions.id}--spice-hot`, group: "Heat", label: "Legacy", priceDelta: "0" },
    );
    const r = fromDraft(withOptions, d);
    if (!r.ok) throw new Error(r.error);
    expect(r.item.options[0].id).toBe(first.id);
    const ids = r.item.options.map((o) => o.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids).toContain(`${withOptions.id}--spice-hot-2`);
  });

  it("toggles the Bestseller tag", () => {
    const on = fromDraft(plainItem, { ...toDraft(plainItem), bestseller: true });
    expect(on.ok && on.item.tags[0]).toBe("Bestseller");
    const off = fromDraft(plainItem, { ...toDraft(plainItem), bestseller: false });
    expect(off.ok && off.item.tags).not.toContain("Bestseller");
  });

  it("keeps a stable groupKey per group across renames and rejects duplicate group names", () => {
    const d = toDraft(withOptions);
    const keys = new Set(d.options.map((o) => o.groupKey));
    expect(keys.size).toBe(new Set(withOptions.options.map((o) => o.group)).size);
    d.options.push({ key: newKey(), groupKey: newKey(), id: "", group: "Extras", label: "A", priceDelta: "0" });
    d.options.push({ key: newKey(), groupKey: newKey(), id: "", group: "extras ", label: "B", priceDelta: "0" });
    const r = fromDraft(withOptions, d);
    expect(r.ok).toBe(false);
    expect(!r.ok && r.error).toMatch(/both called/);
  });
});
