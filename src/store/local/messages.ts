import { templates } from "@/integrations/whatsapp/templates";
import type { Order } from "../DataStore";

export type MessageKind = "order_placed_customer" | "order_placed_cafe" | "status_update" | "payment_received";

/** Single seam for message bodies: delegates to the WhatsApp templates. `amount` is used by payment_received. */
export function messageFor(kind: MessageKind, order: Order, amount = 0): string {
  switch (kind) {
    case "order_placed_customer":
      return templates.orderReceivedCustomer(order);
    case "order_placed_cafe":
      return templates.orderReceivedCafe(order);
    case "status_update":
      return templates.statusUpdate(order);
    case "payment_received":
      return templates.paymentReceived(order, amount);
  }
}
