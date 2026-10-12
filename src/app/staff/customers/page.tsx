import type { Metadata } from "next";
import { Suspense } from "react";
import { CustomersView } from "@/components/staff/CustomersView";
import { RequireStaff } from "@/components/staff/RequireStaff";
import { StaffShell } from "@/components/staff/StaffShell";

export const metadata: Metadata = { title: "Customers" };

export default function StaffCustomersPage() {
  return (
    <RequireStaff>
      <StaffShell>
        {/* useSearchParams (?id=) needs a Suspense boundary in a static export. */}
        <Suspense fallback={null}>
          <CustomersView />
        </Suspense>
      </StaffShell>
    </RequireStaff>
  );
}
