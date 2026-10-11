import type { Metadata } from "next";
import { CheckoutApp } from "@/components/checkout/CheckoutApp";
import { SiteShell } from "@/components/site/SiteShell";

export const metadata: Metadata = {
  title: "Checkout · Gluttons Garage",
  description: "Review your order and pay by UPI, card, netbanking, wallet or at the counter.",
  robots: { index: false },
};

export default function CheckoutPage() {
  return (
    <SiteShell>
      <div className="pt-[4.5rem]">
        <CheckoutApp />
      </div>
    </SiteShell>
  );
}
