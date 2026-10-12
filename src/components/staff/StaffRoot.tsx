"use client";

import type { ReactNode } from "react";
import { Toaster } from "@/components/ui/sonner";
import { StoreProvider } from "@/store";

/** One store for every staff screen, the dark kitchen theme, and the staff toasts. */
export function StaffRoot({ children }: { children: ReactNode }) {
  return (
    <StoreProvider>
      <div className="theme-kitchen flex min-h-dvh flex-1 flex-col">
        {children}
        {/* Bottom-right keeps the board header (sound, new-order pill) clear; above the bottom nav on phones. */}
        <Toaster
          theme="dark"
          position="bottom-right"
          closeButton
          mobileOffset={{ bottom: "calc(5rem + env(safe-area-inset-bottom))" }}
          toastOptions={{ classNames: { toast: "cn-toast text-base" } }}
        />
      </div>
    </StoreProvider>
  );
}
