import { CheckCheck } from "lucide-react";
import { cafe } from "@/data/cafe";
import { renderWhatsApp } from "@/components/track/WhatsAppPreview";

/** How the campaign looks on a customer's WhatsApp. {name} is filled with a sample first name; *bold* renders safely (no HTML). */
export function PhonePreview({ body, sampleName = "Asha" }: { body: string; sampleName?: string }) {
  const text = body.replaceAll("{name}", sampleName);
  return (
    <div className="mx-auto w-full max-w-[20rem] rounded-[2.25rem] border-[10px] border-ink bg-ink shadow-lift" role="group" aria-label="WhatsApp preview">
      <div className="overflow-hidden rounded-[1.6rem] bg-cream-dark text-ink">
        <div className="flex items-center gap-3 bg-maroon px-4 py-3 text-cream-light">
          <span aria-hidden="true" className="grid size-9 place-items-center rounded-full bg-orange font-display text-sm font-bold text-ink">
            GG
          </span>
          <div className="leading-tight">
            <p className="font-bold">{cafe.name}</p>
            <p className="text-xs opacity-90">Business account</p>
          </div>
        </div>
        <div className="min-h-64 bg-cream-dark p-3">
          {text.trim() ? (
            <div className="relative max-w-[92%] rounded-2xl rounded-tl-sm bg-cream-light px-3 py-2 text-[0.9rem] leading-snug shadow-card">
              <p className="break-words" data-testid="preview-text">
                {renderWhatsApp(text)}
              </p>
              <p className="mt-1 flex items-center justify-end gap-1 text-[0.7rem] text-ink-soft">
                now
                <CheckCheck className="size-3.5 text-teal" aria-hidden="true" />
              </p>
            </div>
          ) : (
            <p className="pt-8 text-center text-sm text-ink-soft">Write a message to see the preview.</p>
          )}
        </div>
      </div>
    </div>
  );
}
