"use client";

import { RefreshCw, TimerOff } from "lucide-react";
import QRCode from "qrcode";
import { useEffect, useRef, useState } from "react";
import { upiUri } from "@/integrations/payments/demo";
import { BrandBadge, MethodHeading, type MethodProps } from "./shared";

const LIFETIME_S = 5 * 60;

const cssColor = (name: string) => getComputedStyle(document.documentElement).getPropertyValue(name).trim();

/** Scan-to-pay: demo-only UPI QR (non-routable payee), 5:00 expiry and a "Simulate payment received" demo control. */
export function QrMethod({ req, onPay }: MethodProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [round, setRound] = useState(0);
  const [left, setLeft] = useState(LIFETIME_S);
  const expired = left <= 0;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || expired) return;
    QRCode.toCanvas(canvas, upiUri(req), {
      width: 208,
      margin: 1,
      errorCorrectionLevel: "M",
      color: { dark: cssColor("--foreground"), light: cssColor("--card") },
    }).catch(() => {});
  }, [req, round, expired]);

  useEffect(() => {
    const started = Date.now();
    const t = setInterval(() => setLeft(Math.max(0, LIFETIME_S - Math.floor((Date.now() - started) / 1000))), 1000);
    return () => clearInterval(t);
  }, [round]);

  const refresh = () => {
    setLeft(LIFETIME_S);
    setRound((r) => r + 1);
  };

  const mm = Math.floor(left / 60);
  const ss = String(left % 60).padStart(2, "0");

  return (
    <div>
      <MethodHeading title="Scan and pay" hint="Use any UPI app: Google Pay, PhonePe, Paytm, BHIM" />
      <div className="flex flex-col items-center gap-5 sm:flex-row sm:items-start">
        <div className="relative shrink-0 rounded-2xl border-2 border-primary bg-card p-3 shadow-card">
          <canvas ref={canvasRef} aria-label="UPI QR code for this payment (demo)" role="img" className={expired ? "opacity-10" : undefined} width={208} height={208} />
          {expired && (
            <div className="absolute inset-0 grid place-items-center p-4 text-center">
              <div>
                <TimerOff className="mx-auto size-8 text-primary" aria-hidden="true" />
                <p className="mt-2 font-bold text-primary">QR code expired</p>
                <button
                  type="button"
                  onClick={refresh}
                  className="mt-3 inline-flex h-11 items-center gap-2 rounded-full bg-primary px-4 text-sm font-bold text-primary-foreground"
                >
                  <RefreshCw className="size-4" aria-hidden="true" /> Refresh QR
                </button>
              </div>
            </div>
          )}
        </div>

        <div className="w-full flex-1 text-center sm:text-left">
          {!expired && (
            <>
              <p role="status" className="inline-flex items-center gap-2 font-bold text-primary">
                <span aria-hidden="true" className="relative flex size-2.5">
                  <span className="absolute inset-0 animate-ping rounded-full bg-accent" />
                  <span className="relative size-2.5 rounded-full bg-accent" />
                </span>
                Waiting for payment…
              </p>
              <p className="mt-1 text-sm text-muted-foreground">
                QR expires in{" "}
                <span className="font-bold text-foreground tabular-nums" aria-live="off">
                  {mm}:{ss}
                </span>
              </p>
            </>
          )}
          <div className="mt-4 rounded-xl border border-dashed border-line p-3">
            <p className="text-xs font-bold tracking-wide text-muted-foreground uppercase">Demo control</p>
            <button
              type="button"
              onClick={() => onPay("upi_qr")}
              disabled={expired}
              className="mt-2 inline-flex h-11 w-full items-center justify-center rounded-full border-2 border-primary px-4 text-sm font-bold text-primary transition-colors hover:bg-primary hover:text-primary-foreground disabled:opacity-50"
            >
              Simulate payment received
            </button>
          </div>
          <ol className="mt-4 space-y-1.5 text-left text-sm text-muted-foreground">
            <li>1. Open any UPI app on your phone</li>
            <li>2. Scan this code and approve the payment</li>
            <li>3. This page updates automatically</li>
          </ol>
          <div className="mt-4 flex justify-center gap-2 sm:justify-start">
            {["GPay", "Pe", "Ptm", "BHIM"].map((i) => (
              <BrandBadge key={i} initials={i} className="size-9 text-[0.65rem]" />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
