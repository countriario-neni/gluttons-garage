import type { Metadata } from "next";
import { OwnerPage } from "@/components/staff/OwnerPage";
import { SettingsForm } from "@/components/staff/SettingsForm";

export const metadata: Metadata = { title: "Settings" };

export default function StaffSettingsPage() {
  return (
    <OwnerPage title="Settings" description="Café details, opening hours and ordering controls.">
      <SettingsForm />
    </OwnerPage>
  );
}
