"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState, type ComponentType, type ReactNode } from "react";
import { cn } from "cn";
import {
  BarChart3,
  ClipboardList,
  Gift,
  LayoutGrid,
  LogOut,
  Megaphone,
  Menu as MenuIcon,
  MoreHorizontal,
  RotateCcw,
  Settings,
  Users,
  UtensilsCrossed,
} from "lucide-react";
import { toast } from "sonner";
import { Wordmark } from "@/components/site/Wordmark";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { useStore } from "@/store";
import type { StaffRole } from "@/store/DataStore";
import { ConfirmDialog } from "./ConfirmDialog";
import { staffErrorCopy } from "./format";
import { useStaffSession } from "./RequireStaff";

type NavItem = { href: string; label: string; icon: ComponentType<{ className?: string }>; ownerOnly?: boolean };

/** Later tasks build the other screens; kitchen staff can't edit loyalty, campaigns, reports or settings. */
const NAV: NavItem[] = [
  { href: "/staff/orders/", label: "Orders", icon: ClipboardList },
  { href: "/staff/menu/", label: "Menu", icon: UtensilsCrossed },
  { href: "/staff/tables/", label: "Tables", icon: LayoutGrid },
  { href: "/staff/customers/", label: "Customers", icon: Users },
  { href: "/staff/loyalty/", label: "Loyalty", icon: Gift, ownerOnly: true },
  { href: "/staff/campaigns/", label: "Campaigns", icon: Megaphone, ownerOnly: true },
  { href: "/staff/reports/", label: "Reports", icon: BarChart3, ownerOnly: true },
  { href: "/staff/settings/", label: "Settings", icon: Settings, ownerOnly: true },
];
export const navFor = (role: StaffRole) => NAV.filter((n) => role === "owner" || !n.ownerOnly);

/** Fired before a demo reset so the board doesn't chime for the reseeded orders. */
export const DEMO_RESET_EVENT = "gg:demo-reset";

const roleLabel = (r: StaffRole) => (r === "owner" ? "Owner" : "Kitchen");

function KindPill({ className }: { className?: string }) {
  const kind = useStore().kind;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-2 rounded-full border border-border px-3 py-1 text-xs font-bold",
        kind === "supabase" ? "text-foreground" : "text-muted-foreground",
        className,
      )}
    >
      <span aria-hidden="true" className={cn("size-2 rounded-full", kind === "supabase" ? "bg-success" : "bg-primary")} />
      {kind === "supabase" ? "Live sync · Supabase" : "Demo mode · this device"}
    </span>
  );
}

function NavLink({ item, active, compact, onNavigate }: { item: NavItem; active: boolean; compact?: boolean; onNavigate?: () => void }) {
  const Icon = item.icon;
  return (
    <Link
      href={item.href}
      prefetch={false}
      aria-current={active ? "page" : undefined}
      onClick={onNavigate}
      className={cn(
        "flex items-center rounded-xl font-bold transition-colors",
        compact
          ? "min-h-14 flex-1 flex-col justify-center gap-0.5 px-1 text-xs"
          : "min-h-11 gap-3 px-3 text-base",
        active ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted hover:text-foreground",
      )}
    >
      <Icon className={compact ? "size-5" : "size-5"} aria-hidden="true" />
      {item.label}
    </Link>
  );
}

/** Staff chrome: sidebar on desktop, bottom nav (4 items + More) on tablet and phone. */
export function StaffShell({ children }: { children: ReactNode }) {
  const store = useStore();
  const session = useStaffSession();
  const router = useRouter();
  const pathname = usePathname();
  const items = navFor(session.role);
  const [moreOpen, setMoreOpen] = useState(false);
  const [resetOpen, setResetOpen] = useState(false);
  const isOwner = session.role === "owner";
  const active = (href: string) => pathname === href || pathname === href.slice(0, -1);

  const signOut = async () => {
    await store.staffSignOut();
    router.replace("/staff/");
  };
  const reset = async () => {
    try {
      window.dispatchEvent(new Event(DEMO_RESET_EVENT));
      await store.resetDemo();
      toast.success("Demo data reset", { description: "Orders, customers and messages are back to the seeded demo." });
    } catch (e) {
      toast.error(staffErrorCopy(e));
    }
  };

  const account = (
    <div className="flex items-center gap-3">
      <span aria-hidden="true" className="grid size-10 shrink-0 place-items-center rounded-full bg-muted text-base font-bold">
        {session.name.slice(0, 1).toUpperCase()}
      </span>
      <span className="min-w-0">
        <span className="block truncate font-bold">{session.name}</span>
        <span className="block text-sm text-muted-foreground">{roleLabel(session.role)} access</span>
      </span>
    </div>
  );
  const actions = (onDone?: () => void) => (
    <div className="grid gap-2">
      {isOwner && (
        <Button
          variant="outline"
          className="h-11 justify-start text-base"
          onClick={() => {
            onDone?.();
            setResetOpen(true);
          }}
        >
          <RotateCcw className="size-5" aria-hidden="true" /> Reset demo
        </Button>
      )}
      <Button variant="ghost" className="h-11 justify-start text-base" onClick={() => void signOut()}>
        <LogOut className="size-5" aria-hidden="true" /> Sign out
      </Button>
    </div>
  );

  const bottom = items.slice(0, 4);
  const overflow = items.slice(4);

  return (
    <div className="flex min-h-dvh flex-1">
      {/* Desktop sidebar */}
      <aside className="sticky top-0 hidden h-dvh w-60 shrink-0 flex-col gap-6 border-r border-border bg-sidebar p-4 lg:flex">
        <Link href="/staff/orders/" prefetch={false} className="flex flex-col items-start gap-1 px-2 pt-2" aria-label="Gluttons Garage staff home">
          <Wordmark tone="cream" className="text-2xl" />
          <span className="text-xs font-bold tracking-[0.2em] text-muted-foreground uppercase">Staff</span>
        </Link>
        <nav aria-label="Staff" className="grid gap-1">
          {items.map((n) => (
            <NavLink key={n.href} item={n} active={active(n.href)} />
          ))}
        </nav>
        <div className="mt-auto grid gap-4 border-t border-border pt-4">
          <KindPill className="justify-self-start" />
          {account}
          {actions()}
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col pb-[calc(4rem+env(safe-area-inset-bottom))] lg:pb-0">{children}</div>

      {/* Tablet / phone bottom nav */}
      <nav
        aria-label="Staff"
        className="fixed inset-x-0 bottom-0 z-40 flex gap-1 border-t border-border bg-sidebar px-2 pt-1 pb-[calc(0.25rem+env(safe-area-inset-bottom))] lg:hidden"
      >
        {bottom.map((n) => (
          <NavLink key={n.href} item={n} active={active(n.href)} compact />
        ))}
        <button
          type="button"
          onClick={() => setMoreOpen(true)}
          aria-haspopup="dialog"
          aria-expanded={moreOpen}
          className="flex min-h-14 flex-1 flex-col items-center justify-center gap-0.5 rounded-xl px-1 text-xs font-bold text-muted-foreground hover:bg-muted hover:text-foreground"
        >
          <MoreHorizontal className="size-5" aria-hidden="true" />
          More
        </button>
      </nav>

      <Sheet open={moreOpen} onOpenChange={setMoreOpen}>
        <SheetContent side="bottom" className="theme-kitchen max-h-[85dvh] gap-5 overflow-y-auto rounded-t-2xl border-border p-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))]">
          <SheetHeader className="p-0">
            <SheetTitle className="flex items-center gap-2 text-xl font-bold">
              <MenuIcon className="size-5" aria-hidden="true" /> More
            </SheetTitle>
          </SheetHeader>
          {overflow.length > 0 && (
            <nav aria-label="More staff pages" className="grid gap-1">
              {overflow.map((n) => (
                <NavLink key={n.href} item={n} active={active(n.href)} onNavigate={() => setMoreOpen(false)} />
              ))}
            </nav>
          )}
          <div className="grid gap-4 border-t border-border pt-4">
            <KindPill className="justify-self-start" />
            {account}
            {actions(() => setMoreOpen(false))}
          </div>
        </SheetContent>
      </Sheet>

      <ConfirmDialog
        open={resetOpen}
        onOpenChange={setResetOpen}
        title="Reset the demo?"
        description={`This replaces every order, customer, coupon and message ${store.kind === "supabase" ? "in the shared database" : "on this device"} with the fresh seeded demo data. Your sign-in stays.`}
        confirmLabel="Reset demo data"
        cancelLabel="Keep data"
        destructive
        onConfirm={reset}
      />
    </div>
  );
}
