import type { Metadata } from "next";
import type { ReactNode } from "react";
import { StaffRoot } from "@/components/staff/StaffRoot";

export const metadata: Metadata = {
  title: "Staff · Gluttons Garage",
  robots: { index: false, follow: false },
};

export default function StaffLayout({ children }: { children: ReactNode }) {
  return <StaffRoot>{children}</StaffRoot>;
}
