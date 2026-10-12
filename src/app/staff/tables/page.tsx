import type { Metadata } from "next";
import { RequireStaff } from "@/components/staff/RequireStaff";
import { StaffShell } from "@/components/staff/StaffShell";
import { TablesView } from "@/components/staff/TablesView";

export const metadata: Metadata = { title: "Tables · Gluttons Garage" };

export default function StaffTablesPage() {
  return (
    <RequireStaff>
      <StaffShell>
        <TablesView />
      </StaffShell>
    </RequireStaff>
  );
}
