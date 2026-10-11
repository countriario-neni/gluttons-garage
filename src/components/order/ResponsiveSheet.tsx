"use client";

import { Dialog as D } from "@base-ui/react/dialog";
import { X } from "lucide-react";
import { cn } from "cn";
import type { ReactNode } from "react";

const WIDTH = { sm: "sm:w-[min(30rem,calc(100%-2rem))]", md: "sm:w-[min(36rem,calc(100%-2rem))]", lg: "sm:w-[min(45rem,calc(100%-2rem))]" };

/**
 * One modal, two shapes: a bottom sheet on phones, a centred dialog from `sm` up.
 * Centred with inset-0 + margin auto (not transforms) so the slide/scale transitions compose cleanly.
 */
export function ResponsiveSheet({
  open,
  onOpenChange,
  children,
  size = "md",
  className,
  locked = false,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  children: ReactNode;
  size?: keyof typeof WIDTH;
  className?: string;
  /** Ignore Esc / backdrop while true (e.g. a payment is processing). */
  locked?: boolean;
}) {
  return (
    <D.Root open={open} onOpenChange={(o) => (locked && !o ? undefined : onOpenChange(o))} disablePointerDismissal={locked}>
      <D.Portal>
        <D.Backdrop className="fixed inset-0 z-50 bg-ink/45 backdrop-blur-[2px] transition-opacity duration-300 data-ending-style:opacity-0 data-starting-style:opacity-0" />
        <D.Popup
          className={cn(
            "fixed inset-x-0 bottom-0 z-50 flex max-h-[92dvh] flex-col overflow-hidden rounded-t-[1.5rem] bg-card text-card-foreground shadow-lift outline-none",
            "transition-[translate,scale,opacity] duration-[380ms] ease-[var(--ease-reveal)] data-ending-style:translate-y-full data-starting-style:translate-y-full",
            "sm:inset-0 sm:m-auto sm:h-fit sm:max-h-[min(44rem,90dvh)] sm:rounded-[1.25rem]",
            "sm:data-ending-style:translate-y-0 sm:data-ending-style:scale-95 sm:data-ending-style:opacity-0 sm:data-starting-style:translate-y-0 sm:data-starting-style:scale-95 sm:data-starting-style:opacity-0",
            WIDTH[size],
            className,
          )}
        >
          <div aria-hidden="true" className="mx-auto mt-2.5 h-1.5 w-12 shrink-0 rounded-full bg-line sm:hidden" />
          {children}
        </D.Popup>
      </D.Portal>
    </D.Root>
  );
}

export const SheetTitle = D.Title;
export const SheetDescription = D.Description;

export function SheetCloseButton({ className, label = "Close", disabled }: { className?: string; label?: string; disabled?: boolean }) {
  return (
    <D.Close
      aria-label={label}
      disabled={disabled}
      className={cn(
        "grid size-11 shrink-0 place-items-center rounded-full text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground disabled:opacity-40",
        className,
      )}
    >
      <X className="size-5" aria-hidden="true" />
    </D.Close>
  );
}
