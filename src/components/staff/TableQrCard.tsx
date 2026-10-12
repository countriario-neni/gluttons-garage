"use client";

import { useEffect, useRef, useState } from "react";
import { Download } from "lucide-react";
import QRCode from "qrcode";
import { toast } from "sonner";
import { Wordmark } from "@/components/site/Wordmark";
import { Button } from "@/components/ui/button";
import { withBase } from "@/lib/basePath";

const QR_DARK = "#1a1410";
const QR_LIGHT = "#ffffff";
const MAROON = "#6b1d1d";
const ORANGE = "#e8731a";

const qrUrlFor = (table: number) =>
  `${window.location.origin}${withBase(`/t/?table=${table}`)}`;

const loadImage = (src: string) =>
  new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("QR image failed to load"));
    img.src = src;
  });

/** Composes the same card on a canvas (no html2canvas): background, wordmark, QR, table label. */
async function renderPng(
  table: number,
  qrDataUrl: string,
  wordmarkFont: string,
): Promise<Blob> {
  const W = 800;
  const H = 1000;
  const c = document.createElement("canvas");
  c.width = W;
  c.height = H;
  const g = c.getContext("2d")!;
  g.fillStyle = QR_LIGHT;
  g.fillRect(0, 0, W, H);
  g.strokeStyle = MAROON;
  g.lineWidth = 10;
  g.strokeRect(25, 25, W - 50, H - 50);

  g.textAlign = "center";
  g.textBaseline = "alphabetic";
  g.fillStyle = MAROON;
  g.font = `700 96px ${wordmarkFont}`;
  g.fillText("GLUTTONS", W / 2, 170);
  g.fillStyle = ORANGE;
  g.fillRect(W / 2 - 150, 205, 90, 8);
  g.fillStyle = MAROON;
  g.font = "800 44px system-ui, sans-serif";
  g.fillText("garage", W / 2 + 40, 222);

  g.fillStyle = QR_DARK;
  g.font = "700 48px system-ui, sans-serif";
  g.fillText("Scan to order", W / 2, 320);

  const qr = await loadImage(qrDataUrl);
  g.imageSmoothingEnabled = false;
  g.drawImage(qr, (W - 520) / 2, 350, 520, 520);

  g.fillStyle = MAROON;
  g.font = "800 72px system-ui, sans-serif";
  g.fillText(`Table ${table}`, W / 2, 940);

  return new Promise((resolve, reject) =>
    c.toBlob(
      (b) => (b ? resolve(b) : reject(new Error("PNG export failed"))),
      "image/png",
    ),
  );
}

export function TableQrCard({
  table,
  printOnly = false,
}: {
  table: number;
  printOnly?: boolean;
}) {
  const [qr, setQr] = useState<{ url: string; dataUrl: string } | null>(null);
  const markRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    let live = true;
    const url = qrUrlFor(table);
    QRCode.toDataURL(url, {
      errorCorrectionLevel: "H",
      margin: 1,
      width: 640,
      color: { dark: QR_DARK, light: QR_LIGHT },
    }).then(
      (dataUrl) => live && setQr({ url, dataUrl }),
      () => live && toast.error(`Couldn't build the QR for table ${table}`),
    );
    return () => {
      live = false;
    };
  }, [table]);

  async function download() {
    if (!qr) return;
    try {
      const font = markRef.current
        ? getComputedStyle(
            markRef.current.querySelector("span") ?? markRef.current,
          ).fontFamily
        : "Georgia, serif";
      const blob = await renderPng(table, qr.dataUrl, font);
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = `gluttons-garage-table-${table}.png`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    } catch {
      toast.error("Couldn't make the PNG. Try again.");
    }
  }

  return (
    <article
      aria-label={`Table ${table} QR card`}
      data-qr-url={qr?.url}
      className="qr-card flex flex-col items-center gap-3 rounded-2xl border-2 border-[#6b1d1d] bg-white p-5 text-[#1a1410] [--primary:#6b1d1d]"
    >
      <span ref={markRef}>
        <Wordmark className="text-[2rem]" />
      </span>
      <p className="text-lg font-bold">Scan to order</p>
      {qr ? (
        // eslint-disable-next-line @next/next/no-img-element -- generated data URL
        <img
          src={qr.dataUrl}
          alt={`QR code for table ${table}`}
          className="qr-img aspect-square w-full max-w-56"
        />
      ) : (
        <div
          className="aspect-square w-full max-w-56 animate-pulse rounded-lg bg-[#efe6d6]"
          aria-hidden="true"
        />
      )}
      <p className="text-3xl font-extrabold text-[#6b1d1d]">Table {table}</p>
      {!printOnly && (
        <Button
          variant="outline"
          disabled={!qr}
          onClick={() => void download()}
          className="border-[#6b1d1d] bg-white text-[#6b1d1d] hover:bg-[#f3ead9]"
        >
          <Download aria-hidden="true" />{" "}
          <span>
            Download PNG<span className="sr-only"> for table {table}</span>
          </span>
        </Button>
      )}
    </article>
  );
}
