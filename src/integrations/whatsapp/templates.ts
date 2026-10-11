import { cafe } from "@/data/cafe";
import { pointsEarned } from "@/domain/loyalty";
import { formatINR } from "@/domain/money";
import type { Order } from "@/store/DataStore";

const firstName = (o: Order) => o.customerName.trim().split(/\s+/)[0] || "there";

/** "18:30" -> "6:30 PM" */
function time12(hhmm: string): string {
  const [h, m] = hhmm.split(":").map(Number);
  return `${h % 12 || 12}:${String(m).padStart(2, "0")} ${h < 12 ? "AM" : "PM"}`;
}

const where = (o: Order) => (o.mode === "dine_in" ? `Table ${o.table}` : `Pickup at ${o.pickupTime ? time12(o.pickupTime) : "your slot"}`);

const itemLines = (o: Order) =>
  o.bill.lines.map((l) => `${l.qty}× ${l.name}${l.optionLabels.length ? ` (${l.optionLabels.join(", ")})` : ""}`).join("\n");

const sum = (o: Order, f: (p: Order["payments"][number]) => boolean) => o.payments.filter(f).reduce((s, p) => s + p.amount, 0);

function paymentSummary(o: Order): string {
  const online = sum(o, (p) => p.method === "online" && p.status !== "failed");
  const onlinePaid = online > 0 && o.payments.filter((p) => p.method === "online" && p.status !== "failed").every((p) => p.status === "success");
  const cashDue = sum(o, (p) => p.method === "cash" && p.status === "pending");
  const cashPaid = sum(o, (p) => p.method === "cash" && p.status === "success");
  if (cashDue > 0 && online > 0) return `Split: ${formatINR(online)} online (${onlinePaid ? "paid" : "pending"}) + ${formatINR(cashDue)} cash due`;
  if (cashDue > 0) return `Cash due ${formatINR(cashDue)}`;
  if (online > 0) return onlinePaid ? `Paid online ${formatINR(online)}` : `Online payment pending ${formatINR(online)}`;
  if (cashPaid > 0) return `Paid in cash ${formatINR(cashPaid)}`;
  return "Payment pending";
}

const trackHint = (o: Order) => `📍 Follow your order live on our website under *Track order* with code ${o.code}.`;

export const templates = {
  orderReceivedCustomer(o: Order): string {
    return [
      `Hi ${firstName(o)}! 👋 Thanks for choosing *${cafe.name}*.`,
      `We've received your order *${o.code}*.`,
      "",
      itemLines(o),
      "",
      `*Total: ${formatINR(o.bill.total)}* (incl. GST)`,
      `📌 ${where(o)}`,
      "",
      trackHint(o),
      "We'll message you the moment the kitchen accepts it. 🍳",
    ].join("\n");
  },

  orderReceivedCafe(o: Order): string {
    return [
      `🔔 *New order ${o.code}*`,
      `${o.customerName} · ${o.phone}`,
      `📌 ${where(o)}`,
      "",
      itemLines(o),
      "",
      `*Total: ${formatINR(o.bill.total)}*`,
      `💳 ${paymentSummary(o)}`,
    ].join("\n");
  },

  statusUpdate(o: Order): string {
    const hi = `Hi ${firstName(o)},`;
    switch (o.status) {
      case "accepted":
        return `${hi} good news! ✅ Your order *${o.code}* has been accepted. The kitchen will start on it shortly.\n\n${trackHint(o)}`;
      case "preparing":
        return `${hi} your order *${o.code}* is now being prepared. 👨‍🍳 Fresh and hot, coming right up.`;
      case "ready":
        return o.mode === "dine_in"
          ? `${hi} your order *${o.code}* is ready! 🍽️ It will be served at your table (${where(o)}) in a moment.`
          : `${hi} your order *${o.code}* is ready for pickup at the counter! 🛍️ Please show this code when you arrive (${where(o)}).`;
      case "completed":
        return [
          `${hi} thank you for dining with us! 💛 Order *${o.code}* is complete.`,
          `You've earned *${pointsEarned(o.bill.total)} points* on this order. 100 points = ₹50 off next time.`,
          "",
          `Loved it? A quick Google review means the world to us: ${cafe.mapsUrl} ⭐`,
        ].join("\n");
      case "rejected":
        return `${hi} we're sorry, we couldn't take your order *${o.code}* this time. 🙏 Any payment or points used will be returned. Please call us on ${cafe.phone} and we'll sort it out.`;
      case "cancelled":
        return `${hi} your order *${o.code}* has been cancelled. Any payment or points used will be returned. We'd love to serve you again soon! 🙏`;
      default:
        return `${hi} we've received your order *${o.code}*.`;
    }
  },

  paymentReceived(o: Order, amount: number): string {
    return `Hi ${firstName(o)}, we've received your payment of *${formatINR(amount)}* for order *${o.code}*. ✅ Thank you!`;
  },

  campaign: {
    tiramisu_fest: "Hi {name}! 🍰 Tiramisu Fest is on at Gluttons Garage. Creamy, coffee-soaked and made to be shared. Come by for a slice this week!",
    mango_mania: "Hi {name}! 🥭 Mango Mania has landed at Gluttons Garage. Cool mango specials are here for the season. Grab one before they're gone!",
    we_miss_you: "Hi {name}, we miss you at Gluttons Garage! 💛 Come back this week and use code *WINBACK15* for 15% off your next order.",
    new_menu: "Hi {name}! 🍽️ Our new menu is live at Gluttons Garage, with fresh fusion bites and coffees to try. Order now from our website!",
  } as Record<string, string>,
};

export function waLink(phone: string, text: string): string {
  return `https://wa.me/${phone.replace(/\D/g, "")}?text=${encodeURIComponent(text)}`;
}

/** Customer-to-cafe message, for the "Share on WhatsApp" button. */
export function orderShareText(o: Order): string {
  return [
    `Hi ${cafe.name}! My order *${o.code}* is placed.`,
    "",
    itemLines(o),
    "",
    `Total: ${formatINR(o.bill.total)} · ${where(o)}`,
    `Name: ${o.customerName}`,
  ].join("\n");
}
