import type { Metadata } from "next";
import { OrderApp } from "@/components/order/OrderApp";
import { SiteShell } from "@/components/site/SiteShell";

export const metadata: Metadata = {
  title: "Order online, Beach Road Vizag",
  description: "Order from your table or for takeaway at Gluttons Garage. Pay by UPI, card, netbanking or at the counter.",
};

export default function OrderPage() {
  return (
    <SiteShell>
      <OrderApp />
    </SiteShell>
  );
}
