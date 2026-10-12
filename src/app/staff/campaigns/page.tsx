import type { Metadata } from "next";
import { CampaignComposer } from "@/components/staff/CampaignComposer";
import { OwnerPage } from "@/components/staff/OwnerPage";

export const metadata: Metadata = { title: "Campaigns · Gluttons Garage" };

export default function StaffCampaignsPage() {
  return (
    <OwnerPage title="Campaigns" description="Send a WhatsApp offer to the customers who opted in.">
      <CampaignComposer />
    </OwnerPage>
  );
}
