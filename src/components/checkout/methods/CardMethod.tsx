"use client";

import { CreditCard } from "lucide-react";
import { cn } from "cn";
import { useId, useState } from "react";
import { cardBrand, luhn, validExpiry } from "@/domain/validation";
import { FieldError, MethodHeading, PayButton, type MethodProps } from "./shared";

const BRAND_LABEL = { visa: "Visa", mastercard: "Mastercard", rupay: "RuPay", amex: "Amex", unknown: "" } as const;

/** Groups digits 4-4-4-4 (Amex 4-6-5). */
function formatCard(digits: string): string {
  const d = digits.slice(0, cardBrand(digits) === "amex" ? 15 : 19);
  if (cardBrand(d) === "amex") return [d.slice(0, 4), d.slice(4, 10), d.slice(10)].filter(Boolean).join(" ");
  return d.replace(/(\d{4})(?=\d)/g, "$1 ");
}

function formatExpiry(raw: string, prev: string): string {
  const d = raw.replace(/\D/g, "").slice(0, 4);
  if (raw.length < prev.length && prev.endsWith("/") && !raw.includes("/")) return d.slice(0, 1); // backspace over the slash
  if (d.length === 1 && Number(d) > 1) return `0${d}/`;
  if (d.length >= 2) return `${d.slice(0, 2)}/${d.slice(2)}`;
  return d;
}

type Errors = Partial<Record<"number" | "expiry" | "cvv" | "name", string>>;

/**
 * Card form. Values live only in this component's state: nothing is persisted or sent anywhere,
 * and unmounting (closing the sheet or switching method) discards them.
 */
export function CardMethod({ req, onPay }: MethodProps) {
  const [number, setNumber] = useState("");
  const [expiry, setExpiry] = useState("");
  const [cvv, setCvv] = useState("");
  const [name, setName] = useState("");
  const [errors, setErrors] = useState<Errors>({});
  const id = useId();
  const digits = number.replace(/\D/g, "");
  const brand = cardBrand(digits);
  const cvvLen = brand === "amex" ? 4 : 3;

  const validate = (): Errors => {
    const e: Errors = {};
    if (!luhn(digits) || (brand === "amex" ? digits.length !== 15 : digits.length < 13)) e.number = "Enter a valid card number";
    if (!validExpiry(expiry, new Date())) e.expiry = "Enter a valid expiry date (MM/YY)";
    if (!new RegExp(`^\\d{${cvvLen}}$`).test(cvv)) e.cvv = `Enter the ${cvvLen}-digit CVV`;
    if (name.trim().length < 2) e.name = "Enter the name on the card";
    return e;
  };

  const submit = () => {
    const e = validate();
    setErrors(e);
    const first = (["number", "expiry", "cvv", "name"] as const).find((k) => e[k]);
    if (first) {
      document.getElementById(`${id}-${first}`)?.focus();
      return;
    }
    onPay("card");
  };

  const field = (key: keyof Errors) => ({
    id: `${id}-${key}`,
    "aria-invalid": errors[key] ? true : undefined,
    "aria-describedby": errors[key] ? `${id}-${key}-err` : undefined,
    onBlur: () => setErrors((prev) => (prev[key] ? { ...prev, [key]: validate()[key] } : prev)),
    className: cn(
      "h-12 w-full rounded-xl border bg-background px-4 text-base tracking-wide placeholder:text-muted-foreground placeholder:tracking-normal",
      errors[key] ? "border-destructive" : "border-input",
    ),
  });

  return (
    <div>
      <MethodHeading title="Debit or credit card" hint="Visa, Mastercard, RuPay and Amex" />
      <form
        noValidate
        autoComplete="on"
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
        className="space-y-3.5"
      >
        <div>
          <label htmlFor={`${id}-number`} className="mb-1.5 block text-sm font-bold">
            Card number
          </label>
          <div className="relative">
            <input
              {...field("number")}
              inputMode="numeric"
              autoComplete="cc-number"
              placeholder="1234 5678 9012 3456"
              value={number}
              onChange={(e) => setNumber(formatCard(e.target.value.replace(/\D/g, "")))}
              className={cn(field("number").className, "pr-28")}
            />
            <span className="pointer-events-none absolute top-1/2 right-3 flex -translate-y-1/2 items-center gap-1.5">
              {BRAND_LABEL[brand] ? (
                <span className="rounded-md bg-primary px-2 py-1 text-xs font-bold tracking-wide text-primary-foreground">{BRAND_LABEL[brand]}</span>
              ) : (
                <CreditCard className="size-5 text-muted-foreground" aria-hidden="true" />
              )}
            </span>
          </div>
          {errors.number && <FieldError id={`${id}-number-err`}>{errors.number}</FieldError>}
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label htmlFor={`${id}-expiry`} className="mb-1.5 block text-sm font-bold">
              Expiry (MM/YY)
            </label>
            <input
              {...field("expiry")}
              inputMode="numeric"
              autoComplete="cc-exp"
              placeholder="MM/YY"
              value={expiry}
              onChange={(e) => setExpiry((prev) => formatExpiry(e.target.value, prev))}
            />
            {errors.expiry && <FieldError id={`${id}-expiry-err`}>{errors.expiry}</FieldError>}
          </div>
          <div>
            <label htmlFor={`${id}-cvv`} className="mb-1.5 block text-sm font-bold">
              CVV
            </label>
            <input
              {...field("cvv")}
              type="password"
              inputMode="numeric"
              autoComplete="cc-csc"
              placeholder={brand === "amex" ? "4 digits" : "3 digits"}
              maxLength={cvvLen}
              value={cvv}
              onChange={(e) => setCvv(e.target.value.replace(/\D/g, "").slice(0, cvvLen))}
            />
            {errors.cvv && <FieldError id={`${id}-cvv-err`}>{errors.cvv}</FieldError>}
          </div>
        </div>

        <div>
          <label htmlFor={`${id}-name`} className="mb-1.5 block text-sm font-bold">
            Name on card
          </label>
          <input {...field("name")} autoComplete="cc-name" placeholder="As printed on the card" value={name} onChange={(e) => setName(e.target.value)} />
          {errors.name && <FieldError id={`${id}-name-err`}>{errors.name}</FieldError>}
        </div>

        <p className="text-xs text-muted-foreground">Demo: try 4111 1111 1111 1111, any future expiry, any CVV. Card details are never stored.</p>
        <PayButton amount={req.amount} onClick={submit} />
      </form>
    </div>
  );
}
