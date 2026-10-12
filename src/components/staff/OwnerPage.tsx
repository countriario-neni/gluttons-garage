"use client";

import { useRouter } from "next/navigation";
import { useEffect, type ReactNode } from "react";
import { Loader2 } from "lucide-react";
import { RequireStaff, useStaffSession } from "./RequireStaff";
import { StaffShell } from "./StaffShell";

type Props = { title: string; description?: string; children: ReactNode };

function OwnerGate({ title, description, children }: Props) {
  const { role } = useStaffSession();
  const router = useRouter();
  useEffect(() => {
    if (role !== "owner") router.replace("/staff/orders/");
  }, [role, router]);

  if (role !== "owner") {
    return (
      <div role="status" className="grid flex-1 place-items-center p-6 text-muted-foreground">
        <span className="flex items-center gap-3 text-lg">
          <Loader2 className="size-6 animate-spin motion-reduce:animate-none" aria-hidden="true" />
          This page is for the owner. Taking you back to orders…
        </span>
      </div>
    );
  }
  return (
    <main className="mx-auto w-full max-w-6xl flex-1 p-4 sm:p-6 lg:p-8">
      <header className="mb-6">
        <h1 className="text-3xl font-bold">{title}</h1>
        {description && <p className="mt-1 max-w-prose text-muted-foreground">{description}</p>}
      </header>
      {children}
    </main>
  );
}

/** Shared frame for the owner-only staff screens: sign-in gate, shell, and a redirect for kitchen accounts. */
export function OwnerPage(props: Props) {
  return (
    <RequireStaff>
      <StaffShell>
        <OwnerGate {...props} />
      </StaffShell>
    </RequireStaff>
  );
}
