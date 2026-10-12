import type { Metadata } from "next";
import { Suspense } from "react";
import { SiteShell } from "@/components/site/SiteShell";
import { TrackApp } from "@/components/track/TrackApp";
import { TrackSkeleton } from "@/components/track/TrackSkeleton";

export const metadata: Metadata = {
  title: "Track your order",
  description: "Follow your Gluttons Garage order live, from placed to ready.",
  robots: { index: false },
};

export default function TrackPage() {
  return (
    <SiteShell>
      <div className="pt-[4.5rem]">
        {/* useSearchParams needs a Suspense boundary in a static export. */}
        <Suspense fallback={<TrackSkeleton />}>
          <TrackApp />
        </Suspense>
      </div>
    </SiteShell>
  );
}
