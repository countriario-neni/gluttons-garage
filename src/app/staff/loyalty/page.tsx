import type { Metadata } from "next";
import { LoyaltyView } from "@/components/staff/LoyaltyView";
import { RequireStaff } from "@/components/staff/RequireStaff";
import { StaffShell } from "@/components/staff/StaffShell";

export const metadata: Metadata = { title: "Loyalty · Gluttons Garage" };

export default function StaffLoyaltyPage() {
  return (
    <RequireStaff>
      <StaffShell>
        <LoyaltyView />
      </StaffShell>
    </RequireStaff>
  );
}
