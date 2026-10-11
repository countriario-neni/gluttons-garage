import type { Metadata } from "next";
import { Suspense } from "react";
import { TableLanding } from "@/components/order/TableLanding";
import { SiteShell } from "@/components/site/SiteShell";

export const metadata: Metadata = {
  title: "Your table · Gluttons Garage",
  description: "Order from your table at Gluttons Garage.",
  robots: { index: false },
};

export default function TablePage() {
  return (
    <SiteShell>
      <div className="pt-[4.5rem]">
        <Suspense fallback={<div className="min-h-[50vh]" />}>
          <TableLanding />
        </Suspense>
      </div>
    </SiteShell>
  );
}
