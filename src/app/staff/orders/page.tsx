import type { Metadata } from "next";
import { OrderBoard } from "@/components/staff/OrderBoard";
import { RequireStaff } from "@/components/staff/RequireStaff";
import { StaffShell } from "@/components/staff/StaffShell";

export const metadata: Metadata = { title: "Orders" };

export default function StaffOrdersPage() {
  return (
    <RequireStaff>
      <StaffShell>
        <OrderBoard />
      </StaffShell>
    </RequireStaff>
  );
}
