import type { Metadata } from "next";
import { Suspense } from "react";
import { LoginForm } from "@/components/staff/LoginForm";

export const metadata: Metadata = { title: "Staff sign in · Gluttons Garage" };

export default function StaffLoginPage() {
  return (
    // useSearchParams (?next=) needs a Suspense boundary in a static export.
    <Suspense fallback={null}>
      <LoginForm />
    </Suspense>
  );
}
