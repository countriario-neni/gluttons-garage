import { beforeEach, describe, expect, it } from "vitest";
import { items } from "@/data/menu";
import { CART_KEY, CART_VERSION, addLine, lineKey, sanitizeCart, useCart } from "@/lib/cart";

const sprouts = items.find((i) => i.id === "healthy-breakfast-sprouts-with-honey-spicy-sprouts")!;
const [optA, optB] = sprouts.options;
const salad = items.find((i) => i.name === "Fruit Salad")!;
const [mayo, yogurt] = salad.options;

describe("lineKey / addLine", () => {
  it("ignores option order", () => {
    expect(lineKey({ itemId: "x", optionIds: ["b", "a"], qty: 1 })).toBe(lineKey({ itemId: "x", optionIds: ["a", "b"], qty: 3 }));
  });

  it("merges identical item + options + note, summing qty", () => {
    let lines = addLine([], { itemId: sprouts.id, optionIds: [optB.id, optA.id], qty: 1, note: "less sweet" });
    lines = addLine(lines, { itemId: sprouts.id, optionIds: [optA.id, optB.id], qty: 2, note: " less sweet " });
    expect(lines).toHaveLength(1);
    expect(lines[0].qty).toBe(3);
    expect(lines[0].optionIds).toEqual([optA.id, optB.id].sort());
  });

  it("keeps different notes or options as separate lines", () => {
    let lines = addLine([], { itemId: sprouts.id, optionIds: [optA.id], qty: 1 });
    lines = addLine(lines, { itemId: sprouts.id, optionIds: [optA.id], qty: 1, note: "no honey" });
    lines = addLine(lines, { itemId: sprouts.id, optionIds: [optB.id], qty: 1 });
    expect(lines).toHaveLength(3);
  });

  it("caps merged quantity at 50", () => {
    const lines = addLine([{ itemId: sprouts.id, optionIds: [], qty: 49 }], { itemId: sprouts.id, optionIds: [], qty: 5 });
    expect(lines[0].qty).toBe(50);
  });

  it("drops an empty note and clips long notes to 200 chars", () => {
    expect(addLine([], { itemId: sprouts.id, optionIds: [], qty: 1, note: "   " })[0].note).toBeUndefined();
    expect(addLine([], { itemId: sprouts.id, optionIds: [], qty: 1, note: "x".repeat(300) })[0].note).toHaveLength(200);
  });
});

describe("useCart actions", () => {
  beforeEach(() => {
    localStorage.clear();
    useCart.setState({ mode: null, table: null, pickupTime: null, lines: [] });
  });

  it("add, setQty, remove, clear", () => {
    const { add } = useCart.getState();
    add({ itemId: sprouts.id, optionIds: [], qty: 1 });
    add({ itemId: salad.id, optionIds: [mayo.id], qty: 1 });
    add({ itemId: sprouts.id, optionIds: [], qty: 1 });
    expect(useCart.getState().lines.map((l) => l.qty)).toEqual([2, 1]);
    useCart.getState().setQty(0, 5);
    expect(useCart.getState().lines[0].qty).toBe(5);
    useCart.getState().setQty(0, 0);
    expect(useCart.getState().lines).toHaveLength(1);
    useCart.getState().remove(0);
    expect(useCart.getState().lines).toHaveLength(0);
    add({ itemId: sprouts.id, optionIds: [], qty: 1 });
    useCart.getState().setMode("dine_in", 4);
    useCart.getState().clear();
    expect(useCart.getState().lines).toHaveLength(0);
    expect(useCart.getState().table).toBe(4); // same table can order again
  });

  it("setMode clears the field that no longer applies", () => {
    useCart.getState().setMode("takeaway");
    useCart.getState().setPickup("18:30");
    expect(useCart.getState()).toMatchObject({ mode: "takeaway", table: null, pickupTime: "18:30" });
    useCart.getState().setMode("dine_in", 7);
    expect(useCart.getState()).toMatchObject({ mode: "dine_in", table: 7, pickupTime: null });
  });
});

describe("persistence", () => {
  beforeEach(() => {
    localStorage.clear();
    useCart.setState({ mode: null, table: null, pickupTime: null, lines: [] });
  });

  it("persists only mode, table, pickupTime and lines under gg-cart with a version", () => {
    useCart.getState().setMode("dine_in", 3);
    useCart.getState().add({ itemId: sprouts.id, optionIds: [optA.id], qty: 2 });
    const raw = JSON.parse(localStorage.getItem(CART_KEY)!);
    expect(raw.version).toBe(CART_VERSION);
    expect(Object.keys(raw.state).sort()).toEqual(["lines", "mode", "pickupTime", "table"]);
    expect(raw.state.lines).toEqual([{ itemId: sprouts.id, optionIds: [optA.id], qty: 2 }]);
  });

  it("rehydrates and drops lines whose item or options no longer exist", async () => {
    localStorage.setItem(
      CART_KEY,
      JSON.stringify({
        version: CART_VERSION,
        state: {
          mode: "dine_in",
          table: 4,
          pickupTime: null,
          lines: [
            { itemId: sprouts.id, optionIds: [optA.id], qty: 2 },
            { itemId: "gone-item", optionIds: [], qty: 1 },
            { itemId: sprouts.id, optionIds: ["gone-option"], qty: 1 },
            { itemId: salad.id, optionIds: [mayo.id, yogurt.id], qty: 1 }, // two picks in a single-choice group
            { itemId: salad.id, optionIds: [], qty: 0 },
            { itemId: salad.id, optionIds: [yogurt.id], qty: 1, price: 1 },
          ],
        },
      }),
    );
    await useCart.persist.rehydrate();
    const s = useCart.getState();
    expect(s.mode).toBe("dine_in");
    expect(s.table).toBe(4);
    expect(s.lines).toEqual([
      { itemId: sprouts.id, optionIds: [optA.id], qty: 2 },
      { itemId: salad.id, optionIds: [yogurt.id], qty: 1 },
    ]);
  });

  it("discards state from an unknown version", async () => {
    localStorage.setItem(CART_KEY, JSON.stringify({ version: 0, state: { mode: "dine_in", table: 2, lines: [{ itemId: sprouts.id, optionIds: [], qty: 1 }] } }));
    await useCart.persist.rehydrate();
    expect(useCart.getState().lines).toEqual([]);
    expect(useCart.getState().mode).toBeNull();
  });

  it("sanitizeCart rejects junk values", () => {
    expect(sanitizeCart({ mode: "delivery", table: -1, pickupTime: "soon", lines: "nope" }, items)).toEqual({
      mode: null,
      table: null,
      pickupTime: null,
      lines: [],
    });
  });
});
