"use client";

import { BadgeCheck, Loader2, Smartphone } from "lucide-react";
import { cn } from "cn";
import { useEffect, useId, useState } from "react";
import { useClientValue } from "@/components/order/useOrderData";
import { formatINR } from "@/domain/money";
import { isVpa } from "@/domain/validation";
import { upiUri } from "@/integrations/payments/demo";
import { BrandBadge, FieldError, MethodHeading, PayButton, type MethodProps } from "./shared";

const APPS = [
  { name: "Google Pay", initials: "GPay" },
  { name: "PhonePe", initials: "Pe" },
  { name: "Paytm", initials: "Ptm" },
  { name: "BHIM", initials: "BHIM" },
];

const isAndroid = () => /Android/i.test(navigator.userAgent);

/** UPI apps (real upi:// intent on Android, demo confirm elsewhere) and pay-by-UPI-ID with a verify step. */
export function UpiMethod({ req, onPay }: MethodProps) {
  const android = useClientValue(isAndroid, false);
  const [app, setApp] = useState<string | null>(null);

  return (
    <div className="space-y-7">
      <section>
        <MethodHeading title="Pay with a UPI app" hint={android ? "Opens the app on this phone" : "Approve the request in the app on your phone"} />
        <ul className="grid grid-cols-4 gap-2">
          {APPS.map((a) => {
            const inner = (
              <>
                <BrandBadge initials={a.initials} className="size-12 text-[0.7rem]" />
                <span className="text-xs font-bold">{a.name}</span>
              </>
            );
            const cls = cn(
              "flex min-h-24 w-full flex-col items-center justify-center gap-2 rounded-xl border-2 p-2 text-center transition-colors",
              app === a.name ? "border-primary bg-primary/5" : "border-border bg-card hover:border-primary/50",
            );
            return (
              <li key={a.name}>
                {android ? (
                  // Real UPI intent: the app opens, then fails harmlessly because the demo payee is non-routable.
                  <a href={upiUri(req)} onClick={() => setApp(a.name)} className={cls} aria-label={`Pay with ${a.name}`}>
                    {inner}
                  </a>
                ) : (
                  <button type="button" onClick={() => setApp(a.name)} aria-pressed={app === a.name} className={cls} aria-label={`Pay with ${a.name}`}>
                    {inner}
                  </button>
                )}
              </li>
            );
          })}
        </ul>
        {app && (
          <div role="status" className="reveal mt-4 rounded-xl border border-border bg-secondary/60 p-4">
            <p className="flex items-center gap-2 font-bold text-primary">
              <Smartphone className="size-5" aria-hidden="true" />
              {android ? `Complete the payment in ${app}` : `Open ${app} on your phone`}
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              Approve the request for {formatINR(req.amount)} to Gluttons Garage. In this demo, confirm it here.
            </p>
            <div className="mt-3">
              <PayButton amount={req.amount} onClick={() => onPay("upi_intent")}>
                Confirm in app (demo)
              </PayButton>
            </div>
          </div>
        )}
      </section>

      <div className="flex items-center gap-3 text-xs font-bold tracking-widest text-muted-foreground uppercase">
        <span className="h-px flex-1 bg-border" /> or <span className="h-px flex-1 bg-border" />
      </div>

      <UpiIdForm req={req} onPay={onPay} />
    </div>
  );
}

function UpiIdForm({ req, onPay }: MethodProps) {
  const [vpa, setVpa] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [state, setState] = useState<"idle" | "verifying" | "verified">("idle");
  const id = useId();

  useEffect(() => {
    if (state !== "verifying") return;
    const t = setTimeout(() => setState("verified"), 700);
    return () => clearTimeout(t);
  }, [state]);

  const verify = () => {
    if (!isVpa(vpa.trim())) {
      setError("Enter a valid UPI ID, like name@okhdfcbank");
      return;
    }
    setError(null);
    setState("verifying");
  };

  return (
    <section>
      <MethodHeading title="Pay with UPI ID" hint="A collect request is sent to your UPI app" />
      <label htmlFor={id} className="mb-1.5 block text-sm font-bold">
        UPI ID
      </label>
      <div className="flex gap-2">
        <input
          id={id}
          value={vpa}
          onChange={(e) => {
            setVpa(e.target.value);
            setState("idle");
          }}
          onKeyDown={(e) => e.key === "Enter" && verify()}
          autoComplete="off"
          autoCapitalize="none"
          spellCheck={false}
          placeholder="yourname@okhdfcbank"
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? `${id}-err` : undefined}
          className={cn(
            "h-12 min-w-0 flex-1 rounded-xl border bg-background px-4 text-base placeholder:text-muted-foreground",
            error ? "border-destructive" : "border-input",
          )}
        />
        <button
          type="button"
          onClick={verify}
          disabled={state === "verifying"}
          className="inline-flex h-12 shrink-0 items-center gap-2 rounded-xl border-2 border-primary px-4 font-bold text-primary transition-colors hover:bg-primary/5 disabled:opacity-60"
        >
          {state === "verifying" && <Loader2 className="size-4 animate-spin" aria-hidden="true" />}
          Verify
        </button>
      </div>
      {error && <FieldError id={`${id}-err`}>{error}</FieldError>}
      {state === "verified" && (
        <div role="status" className="reveal mt-4 space-y-3">
          <p className="flex items-start gap-2 rounded-xl bg-success/10 p-3 text-sm">
            <BadgeCheck className="mt-0.5 size-5 shrink-0 text-success" aria-hidden="true" />
            <span>
              <span className="block font-bold text-success">Verified · {vpa.trim()}</span>
              <span className="text-muted-foreground">Paying Gluttons Garage · {formatINR(req.amount)}</span>
            </span>
          </p>
          <PayButton amount={req.amount} onClick={() => onPay("upi_id", { vpa: vpa.trim() })} />
        </div>
      )}
    </section>
  );
}
