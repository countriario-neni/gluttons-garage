"use client";

import { useState, type ReactNode } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: ReactNode;
  confirmLabel: string;
  cancelLabel?: string;
  destructive?: boolean;
  /** Resolves when done; the dialog stays open (button disabled) while it runs. */
  onConfirm: () => Promise<void>;
};

/** In-app confirmation (never window.confirm), themed for the kitchen screens. */
export function ConfirmDialog({ open, onOpenChange, title, description, confirmLabel, cancelLabel = "Cancel", destructive, onConfirm }: Props) {
  const [pending, setPending] = useState(false);
  const confirm = async () => {
    setPending(true);
    try {
      await onConfirm();
      onOpenChange(false);
    } finally {
      setPending(false);
    }
  };
  return (
    <Dialog open={open} onOpenChange={(o) => !pending && onOpenChange(o)}>
      <DialogContent className="theme-kitchen gap-5 p-6 shadow-lift ring-2 ring-primary/50 sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold">{title}</DialogTitle>
          <DialogDescription className="text-base">{description}</DialogDescription>
        </DialogHeader>
        <DialogFooter className="-mx-6 -mb-6 bg-card p-4">
          <Button variant="outline" className="h-12 px-5 text-base" disabled={pending} onClick={() => onOpenChange(false)}>
            {cancelLabel}
          </Button>
          <Button
            className={destructive ? "h-12 bg-destructive px-5 text-base text-destructive-foreground hover:bg-destructive/85" : "h-12 px-5 text-base"}
            disabled={pending}
            onClick={() => void confirm()}
          >
            {pending && <Loader2 className="size-5 animate-spin motion-reduce:animate-none" aria-hidden="true" />}
            {confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
