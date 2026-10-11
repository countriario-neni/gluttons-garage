import { MessageCircle, PauseCircle, Phone } from "lucide-react";
import { callHref, chatHref } from "@/components/site/links";

/** Shown when settings.acceptingOrders is off: browsing still works, adding is disabled. */
export function NotAcceptingBanner() {
  return (
    <div role="status" className="border-b border-border bg-secondary">
      <div className="mx-auto flex max-w-7xl flex-col gap-3 px-4 py-4 sm:flex-row sm:items-center sm:px-6 lg:px-8">
        <PauseCircle className="hidden size-6 shrink-0 text-primary sm:block" aria-hidden="true" />
        <div className="flex-1">
          <p className="font-bold text-primary">Not accepting online orders right now</p>
          <p className="text-sm text-muted-foreground">You can still browse the menu. Call or WhatsApp us, or order at the counter.</p>
        </div>
        <div className="flex gap-2">
          <a href={callHref} className="inline-flex h-11 items-center gap-2 rounded-full border-2 border-primary px-4 text-sm font-bold text-primary">
            <Phone className="size-4" aria-hidden="true" /> Call
          </a>
          <a
            href={chatHref}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex h-11 items-center gap-2 rounded-full bg-success px-4 text-sm font-bold text-success-foreground"
          >
            <MessageCircle className="size-4" aria-hidden="true" /> WhatsApp
          </a>
        </div>
      </div>
    </div>
  );
}
