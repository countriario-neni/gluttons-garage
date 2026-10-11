import type { Order } from "../DataStore";

export type MessageKind = "order_placed_customer" | "order_placed_cafe" | "status_update";

/** Single seam for message bodies: Task 5 swaps this for the WhatsApp templates. */
export function messageFor(kind: MessageKind, order: Order): string {
  switch (kind) {
    case "order_placed_customer":
      return `Hi ${order.customerName}, we received your order ${order.code} (total Rs ${order.bill.total}). We will confirm shortly.`;
    case "order_placed_cafe":
      return `New order ${order.code} from ${order.customerName} (${order.phone}): Rs ${order.bill.total}, ${order.mode === "dine_in" ? `table ${order.table}` : `pickup ${order.pickupTime}`}.`;
    case "status_update":
      return `Order ${order.code} is now ${order.status}.`;
  }
}
