"use client";

import { useState } from "react";
import { cn } from "cn";
import { Eye, EyeOff } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { CustomerStats } from "@/store/DataStore";

/** "98•••••210": first two and last three digits. */
export const maskPhone = (p: string) => (p.length >= 6 ? `${p.slice(0, 2)}•••••${p.slice(-3)}` : "•••••");

/** "+91 98765 43210". */
export const fullPhone = (p: string) => `+91 ${p.slice(0, 5)} ${p.slice(5)}`;

export const TAG_LABEL: Record<CustomerStats["tags"][number], string> = { new: "New", regular: "Regular", vip: "VIP", inactive: "Inactive" };
export const TAGS = Object.keys(TAG_LABEL) as CustomerStats["tags"];

const TAG_VARIANT = { new: "secondary", regular: "outline", vip: "default", inactive: "outline" } as const;

export function TagBadge({ tag }: { tag: CustomerStats["tags"][number] }) {
  return (
    <Badge variant={TAG_VARIANT[tag]} className={cn("h-6 px-2.5 text-xs font-bold", tag === "inactive" && "border-destructive text-foreground")}>
      {TAG_LABEL[tag]}
    </Badge>
  );
}

/** Masked phone number with a reveal toggle (the full number is a deliberate click away). */
export function PhoneReveal({ phone, className }: { phone: string; className?: string }) {
  const [shown, setShown] = useState(false);
  return (
    <span className={cn("inline-flex items-center gap-1", className)}>
      <span className="tabular-nums" data-testid="phone">
        {shown ? fullPhone(phone) : maskPhone(phone)}
      </span>
      <button
        type="button"
        onClick={() => setShown((s) => !s)}
        aria-pressed={shown}
        aria-label={shown ? "Hide phone number" : "Reveal phone number"}
        className="grid size-11 place-items-center rounded-full text-muted-foreground outline-none hover:bg-muted hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50"
      >
        {shown ? <EyeOff className="size-4" aria-hidden="true" /> : <Eye className="size-4" aria-hidden="true" />}
      </button>
    </span>
  );
}

const IST = "Asia/Kolkata";
/** "12 Oct 2026" in café time. */
export const dayLabel = (iso: string) =>
  new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric", timeZone: IST });
