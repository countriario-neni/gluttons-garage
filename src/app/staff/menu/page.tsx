import type { Metadata } from "next";
import { MenuEditor } from "@/components/staff/MenuEditor";
import { RequireStaff } from "@/components/staff/RequireStaff";
import { StaffShell } from "@/components/staff/StaffShell";

export const metadata: Metadata = { title: "Menu" };

export default function StaffMenuPage() {
  return (
    <RequireStaff>
      <StaffShell>
        <MenuEditor />
      </StaffShell>
    </RequireStaff>
  );
}
