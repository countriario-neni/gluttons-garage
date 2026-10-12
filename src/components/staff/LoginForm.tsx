"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useId, useState, type FormEvent } from "react";
import { ChefHat, Eye, EyeOff, KeyRound, Loader2, ShieldCheck } from "lucide-react";
import { Wordmark } from "@/components/site/Wordmark";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useStore } from "@/store";

const DEMO = {
  owner: { email: "owner@gluttonsgarage.demo", password: "garage123" },
  kitchen: { email: "kitchen@gluttonsgarage.demo", password: "garage123" },
} as const;

/** Only same-app staff paths are honoured, so ?next= can never send someone off-site. */
const safeNext = (next: string | null) => (next && /^\/staff\/[\w\-/]*$/.test(next) && next !== "/staff/" ? next : "/staff/orders/");

export function LoginForm() {
  const store = useStore();
  const router = useRouter();
  const next = safeNext(useSearchParams().get("next"));
  const demo = store.kind === "local";
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [checked, setChecked] = useState(false);
  const errorId = useId();

  // Already signed in: skip the form.
  useEffect(() => {
    let live = true;
    store.staffSession().then(
      (s) => {
        if (!live) return;
        if (s) router.replace(next);
        else setChecked(true);
      },
      () => live && setChecked(true),
    );
    return () => {
      live = false;
    };
  }, [store, router, next]);

  async function signIn(e: string, p: string) {
    setError(null);
    if (!e.trim() || !p) {
      setError("Enter your email and password.");
      return;
    }
    setPending(true);
    try {
      const r = await store.staffSignIn(e, p);
      if (r.ok) {
        router.replace(next);
        return;
      }
      setError("Wrong email or password. Check them and try again.");
    } catch {
      setError("Couldn't reach the server. Check your connection and try again.");
    }
    setPending(false);
  }

  const onSubmit = (ev: FormEvent) => {
    ev.preventDefault();
    void signIn(email, password);
  };
  const oneTap = (who: keyof typeof DEMO) => {
    setEmail(DEMO[who].email);
    setPassword(DEMO[who].password);
    void signIn(DEMO[who].email, DEMO[who].password);
  };

  return (
    <main className="grid flex-1 place-items-center px-4 py-10">
      <div className="w-full max-w-md">
        <div className="mb-8 flex flex-col items-center gap-3 text-center">
          <Wordmark tone="cream" className="text-4xl" />
          <p className="text-sm font-bold tracking-[0.2em] text-muted-foreground uppercase">Staff · Kitchen display</p>
        </div>

        <section className="rounded-2xl border border-border bg-card p-6 shadow-lift sm:p-8" aria-labelledby="login-title">
          <h1 id="login-title" className="text-3xl font-bold">
            Staff sign in
          </h1>
          <p className="mt-1 text-muted-foreground">Orders, menu and the kitchen board.</p>

          <form onSubmit={onSubmit} noValidate className="mt-6 grid gap-5" aria-busy={pending || !checked}>
            <div className="grid gap-2">
              <Label htmlFor="staff-email" className="text-base">
                Email
              </Label>
              <Input
                id="staff-email"
                type="email"
                autoComplete="username"
                inputMode="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                aria-invalid={error ? true : undefined}
                aria-describedby={error ? errorId : undefined}
                className="h-12 text-base"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="staff-password" className="text-base">
                Password
              </Label>
              <div className="relative">
                <Input
                  id="staff-password"
                  type={show ? "text" : "password"}
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  aria-invalid={error ? true : undefined}
                  aria-describedby={error ? errorId : undefined}
                  className="h-12 pr-14 text-base"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="absolute top-0.5 right-0.5"
                  aria-label={show ? "Hide password" : "Show password"}
                  aria-pressed={show}
                  onClick={() => setShow((v) => !v)}
                >
                  {show ? <EyeOff className="size-5" aria-hidden="true" /> : <Eye className="size-5" aria-hidden="true" />}
                </Button>
              </div>
            </div>
            {error && (
              <p id={errorId} role="alert" className="rounded-lg border border-destructive bg-destructive/15 px-3 py-2 font-medium text-foreground">
                {error}
              </p>
            )}
            <Button type="submit" size="lg" className="h-12 text-base font-bold" disabled={pending}>
              {pending ? <Loader2 className="size-5 animate-spin motion-reduce:animate-none" aria-hidden="true" /> : <KeyRound className="size-5" aria-hidden="true" />}
              Sign in
            </Button>
          </form>
        </section>

        {demo && (
          <section
            aria-labelledby="demo-creds"
            className="mt-5 rounded-2xl border border-dashed border-primary/60 bg-primary/10 p-5"
          >
            <div className="flex items-center gap-2">
              <span className="rounded-full bg-primary px-2.5 py-0.5 text-xs font-bold tracking-wide text-primary-foreground uppercase">Demo</span>
              <h2 id="demo-creds" className="font-sans text-lg font-bold">
                Demo credentials
              </h2>
            </div>
            <p className="mt-2 text-sm text-muted-foreground">
              For the pitch demo only. Password for both: <code className="font-mono text-foreground">garage123</code>
            </p>
            <dl className="mt-3 grid gap-1 text-sm">
              <div className="flex flex-wrap gap-x-2">
                <dt className="text-muted-foreground">Owner</dt>
                <dd className="font-mono">{DEMO.owner.email}</dd>
              </div>
              <div className="flex flex-wrap gap-x-2">
                <dt className="text-muted-foreground">Kitchen</dt>
                <dd className="font-mono">{DEMO.kitchen.email}</dd>
              </div>
            </dl>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <Button type="button" variant="secondary" className="h-12 text-base" disabled={pending} onClick={() => oneTap("owner")}>
                <ShieldCheck className="size-5" aria-hidden="true" /> Sign in as Owner
              </Button>
              <Button type="button" variant="secondary" className="h-12 text-base" disabled={pending} onClick={() => oneTap("kitchen")}>
                <ChefHat className="size-5" aria-hidden="true" /> Sign in as Kitchen
              </Button>
            </div>
          </section>
        )}
      </div>
    </main>
  );
}
