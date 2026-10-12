import type { Metadata } from "next";
import { OwnerPage } from "@/components/staff/OwnerPage";
import { ReportsView } from "@/components/staff/ReportsView";

export const metadata: Metadata = { title: "Reports" };

export default function StaffReportsPage() {
  return (
    <OwnerPage title="Reports" description="Revenue, busy hours and best sellers.">
      <ReportsView />
    </OwnerPage>
  );
}
