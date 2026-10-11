import { describe, expect, it } from "vitest";
import { cafe } from "@/data/cafe";
import type { Order } from "@/store/DataStore";
import { orderShareText, templates, waLink } from "@/integrations/whatsapp/templates";

function order(over: Partial<Order> = {}): Order {
  return {
    id: "o1",
    code: "GG-1234",
    customerId: "c1",
    customerName: "Asha Rao",
    phone: "9876543210",
    mode: "dine_in",
    table: 7,
    pickupTime: null,
    status: "placed",
    bill: {
      lines: [
        { itemId: "a", optionIds: [], qty: 2, name: "Nutella Pancakes", unitPrice: 200, lineTotal: 400, optionLabels: ["Extra Nutella", "Banana"] },
        { itemId: "b", optionIds: [], qty: 1, name: "Cheesy French Fries", unitPrice: 50, lineTotal: 50, optionLabels: [] },
      ],
      subtotal: 450, couponDiscount: 0, loyaltyDiscount: 0, pointsRedeemed: 0, taxable: 450, cgst: 11, sgst: 11, total: 472,
    },
    couponCode: null,
    paymentStatus: "unpaid",
    payments: [],
    createdAt: "2026-10-11T10:00:00.000Z",
    updatedAt: "2026-10-11T10:00:00.000Z",
    ...over,
  };
}
const pay = (method: "online" | "cash", amount: number, status: "success" | "pending" = "success") => ({
  id: "p" + amount, method, channel: method === "cash" ? "cash" : "upi_intent", amount, status, reference: null, createdAt: "x",
});

describe("orderReceivedCustomer", () => {
  it("includes code, items with options, total, table and tracking hint", () => {
    const t = templates.orderReceivedCustomer(order());
    for (const s of ["GG-1234", "Asha", "2× Nutella Pancakes (Extra Nutella, Banana)", "1× Cheesy French Fries", "₹472", "Table 7"]) expect(t).toContain(s);
    expect(t).toMatch(/track/i);
    expect(t).toContain("*");
    expect(t).toContain("\n");
  });
  it("shows 12-hour pickup for takeaway", () => {
    const t = templates.orderReceivedCustomer(order({ mode: "takeaway", table: null, pickupTime: "18:30" }));
    expect(t).toContain("Pickup at 6:30 PM");
    expect(t).not.toContain("Table");
  });
  it("formats noon and midnight edges", () => {
    expect(templates.orderReceivedCustomer(order({ mode: "takeaway", table: null, pickupTime: "12:05" }))).toContain("12:05 PM");
    expect(templates.orderReceivedCustomer(order({ mode: "takeaway", table: null, pickupTime: "00:15" }))).toContain("12:15 AM");
  });
});

describe("orderReceivedCafe", () => {
  it("includes customer name, phone and payment summary", () => {
    const paid = templates.orderReceivedCafe(order({ paymentStatus: "paid", payments: [pay("online", 472)] }));
    expect(paid).toContain("Asha Rao");
    expect(paid).toContain("9876543210");
    expect(paid).toContain("Paid online");
    expect(templates.orderReceivedCafe(order({ payments: [pay("cash", 472, "pending")] }))).toContain("Cash due ₹472");
    const split = templates.orderReceivedCafe(order({ paymentStatus: "partial", payments: [pay("online", 200), pay("cash", 272, "pending")] }));
    expect(split).toContain("Split");
    expect(split).toContain("₹272");
  });
});

describe("statusUpdate", () => {
  const statuses = ["accepted", "preparing", "ready", "completed", "rejected", "cancelled"] as const;
  it("has distinct copy per status and includes the code", () => {
    const texts = statuses.map((s) => templates.statusUpdate(order({ status: s })));
    expect(new Set(texts).size).toBe(statuses.length);
    texts.forEach((t) => expect(t).toContain("GG-1234"));
  });
  it("ready differs by mode", () => {
    expect(templates.statusUpdate(order({ status: "ready" }))).toContain("served at your table");
    expect(templates.statusUpdate(order({ status: "ready", mode: "takeaway", table: null, pickupTime: "18:30" }))).toContain("ready for pickup at the counter");
  });
  it("completed has loyalty hint and review link", () => {
    const t = templates.statusUpdate(order({ status: "completed" }));
    expect(t).toContain("47 points");
    expect(t).toContain(cafe.mapsUrl);
  });
});

describe("paymentReceived", () => {
  it("mentions amount and code", () => {
    const t = templates.paymentReceived(order(), 272);
    expect(t).toContain("₹272");
    expect(t).toContain("GG-1234");
  });
});

describe("campaign", () => {
  it("has 4 templates with {name}; we_miss_you has WINBACK15", () => {
    expect(Object.keys(templates.campaign).sort()).toEqual(["mango_mania", "new_menu", "tiramisu_fest", "we_miss_you"]);
    for (const t of Object.values(templates.campaign)) expect(t).toContain("{name}");
    expect(templates.campaign.we_miss_you).toContain("WINBACK15");
  });
});

describe("waLink / orderShareText", () => {
  it("strips non-digits and encodes newlines", () => {
    const l = waLink("+91 77023-68884", "Hi\nthere & you");
    expect(l.startsWith("https://wa.me/917702368884?text=")).toBe(true);
    expect(l).toContain("%0A");
    expect(l).toContain("%26");
  });
  it("share text addresses the cafe with the order code", () => {
    const t = orderShareText(order());
    expect(t).toContain("Hi Gluttons Garage!");
    expect(t).toContain("GG-1234");
  });
});
