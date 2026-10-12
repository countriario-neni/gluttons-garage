"use client";

import { usePathname, useRouter } from "next/navigation";
import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { Loader2 } from "lucide-react";
import { useStore } from "@/store";
import type { StaffRole } from "@/store/DataStore";

export type StaffSession = { role: StaffRole; name: string };

const SessionContext = createContext<StaffSession | null>(null);

export function useStaffSession(): StaffSession {
  const s = useContext(SessionContext);
  if (!s) throw new Error("useStaffSession must be used inside <RequireStaff>");
  return s;
}

/** Login path that brings the user back to `path` afterwards. */
export const loginHref = (path: string) => `/staff/?next=${encodeURIComponent(path)}`;

/**
 * Client-side gate for staff screens: nothing below it renders (no flash of orders) until the session check
 * resolves; without a session it redirects to the login with ?next=.
 */
export function RequireStaff({ children }: { children: ReactNode }) {
  const store = useStore();
  const router = useRouter();
  const pathname = usePathname();
  const [session, setSession] = useState<StaffSession | null | undefined>(undefined);

  useEffect(() => {
    let live = true;
    store.staffSession().then(
      (s) => {
        if (!live) return;
        setSession(s);
        if (!s) router.replace(loginHref(pathname));
      },
      () => live && (setSession(null), router.replace(loginHref(pathname))),
    );
    return () => {
      live = false;
    };
  }, [store, router, pathname]);

  if (!session) {
    return (
      <div role="status" className="grid flex-1 place-items-center text-muted-foreground">
        <span className="flex items-center gap-3 text-lg">
          <Loader2 className="size-6 animate-spin motion-reduce:animate-none" aria-hidden="true" />
          {session === null ? "Redirecting to sign in…" : "Checking your staff session…"}
        </span>
      </div>
    );
  }
  return <SessionContext.Provider value={session}>{children}</SessionContext.Provider>;
}
