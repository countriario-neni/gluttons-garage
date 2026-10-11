"use client";

import { Search } from "lucide-react";
import { useMemo, useState } from "react";
import { formatINR } from "@/domain/money";
import { BrandBadge, ChoiceRow, MethodHeading, PayButton, type MethodProps } from "./shared";

type Choice = { name: string; initials: string; hint?: string };

const POPULAR_BANKS: Choice[] = [
  { name: "SBI", initials: "SBI" },
  { name: "HDFC Bank", initials: "HDFC" },
  { name: "ICICI Bank", initials: "ICICI" },
  { name: "Axis Bank", initials: "AXIS" },
  { name: "Kotak Mahindra Bank", initials: "KMB" },
  { name: "Yes Bank", initials: "YES" },
];

const OTHER_BANKS = [
  "Bank of Baroda",
  "Punjab National Bank",
  "Canara Bank",
  "Union Bank of India",
  "Indian Bank",
  "Bank of India",
  "Central Bank of India",
  "IndusInd Bank",
  "IDFC FIRST Bank",
  "Federal Bank",
  "South Indian Bank",
  "Karur Vysya Bank",
  "City Union Bank",
  "RBL Bank",
  "Andhra Pragathi Grameena Bank",
  "AU Small Finance Bank",
];

const initialsOf = (name: string) =>
  name
    .split(/\s+/)
    .filter((w) => /^[A-Z]/.test(w))
    .map((w) => w[0])
    .join("")
    .slice(0, 4);

export function NetbankingMethod({ req, onPay }: MethodProps) {
  const [bank, setBank] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const others = useMemo(() => OTHER_BANKS.filter((b) => b.toLowerCase().includes(q.trim().toLowerCase())), [q]);

  return (
    <div>
      <MethodHeading title="Netbanking" hint="You'll be taken to your bank to log in" />
      <p className="mb-2 text-sm font-bold text-muted-foreground">Popular banks</p>
      <ul className="grid grid-cols-3 gap-2">
        {POPULAR_BANKS.map((b) => (
          <li key={b.name}>
            <button
              type="button"
              aria-pressed={bank === b.name}
              onClick={() => setBank(b.name)}
              className={
                "flex min-h-20 w-full flex-col items-center justify-center gap-1.5 rounded-xl border-2 p-2 text-center text-xs font-bold transition-colors " +
                (bank === b.name ? "border-primary bg-primary/5" : "border-border bg-card hover:border-primary/50")
              }
            >
              <BrandBadge initials={b.initials} className="h-8 w-12 text-[0.65rem]" />
              {b.name.replace(" Mahindra", "")}
            </button>
          </li>
        ))}
      </ul>

      <label htmlFor="nb-search" className="mt-5 mb-1.5 block text-sm font-bold text-muted-foreground">
        All other banks
      </label>
      <div className="relative">
        <Search className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
        <input
          id="nb-search"
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search your bank"
          className="h-11 w-full rounded-xl border border-input bg-background pr-3 pl-10 text-base placeholder:text-muted-foreground"
        />
      </div>
      <ul aria-label="Other banks" className="mt-2 max-h-48 space-y-1.5 overflow-y-auto pr-1">
        {others.map((b) => (
          <li key={b}>
            <ChoiceRow label={b} initials={initialsOf(b)} selected={bank === b} onSelect={() => setBank(b)} />
          </li>
        ))}
        {others.length === 0 && <li className="py-3 text-sm text-muted-foreground">No bank matches “{q}”.</li>}
      </ul>

      <div className="mt-5">
        <PayButton amount={req.amount} disabled={!bank} onClick={() => onPay("netbanking")}>
          {bank ? `Pay ${formatINR(req.amount)} via ${bank}` : "Choose a bank"}
        </PayButton>
      </div>
    </div>
  );
}

function PickAndPay({ title, hint, choices, channel, req, onPay }: MethodProps & { title: string; hint: string; choices: Choice[]; channel: "wallet" | "paylater" }) {
  const [pick, setPick] = useState<string | null>(null);
  return (
    <div>
      <MethodHeading title={title} hint={hint} />
      <ul className="space-y-2">
        {choices.map((c) => (
          <li key={c.name}>
            <ChoiceRow label={c.name} initials={c.initials} hint={c.hint} selected={pick === c.name} onSelect={() => setPick(c.name)} />
          </li>
        ))}
      </ul>
      <div className="mt-5">
        <PayButton amount={req.amount} disabled={!pick} onClick={() => onPay(channel)}>
          {pick ? `Pay ${formatINR(req.amount)} with ${pick}` : `Choose ${channel === "wallet" ? "a wallet" : "a provider"}`}
        </PayButton>
      </div>
    </div>
  );
}

const WALLETS: Choice[] = [
  { name: "Paytm Wallet", initials: "Ptm" },
  { name: "PhonePe Wallet", initials: "Pe" },
  { name: "Amazon Pay", initials: "aPay" },
  { name: "Mobikwik", initials: "MK" },
];

const PAY_LATER: Choice[] = [
  { name: "Simpl", initials: "S", hint: "Pay in one go at the end of the cycle" },
  { name: "LazyPay", initials: "LP", hint: "Buy now, pay in 15 days" },
  { name: "ICICI PayLater", initials: "ICICI", hint: "For ICICI Bank customers" },
];

export const WalletMethod = (p: MethodProps) => (
  <PickAndPay {...p} title="Wallets" hint="Pay from your wallet balance" choices={WALLETS} channel="wallet" />
);

export const PayLaterMethod = (p: MethodProps) => (
  <PickAndPay {...p} title="Pay Later" hint="Eat now, pay later. Subject to provider approval" choices={PAY_LATER} channel="paylater" />
);
