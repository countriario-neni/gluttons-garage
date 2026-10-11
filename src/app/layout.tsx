import type { Metadata } from "next";
import { Playfair_Display, Karla, Bevan, Nunito } from "next/font/google";
import { WhatsAppFab } from "@/components/site/WhatsAppFab";
import "./globals.css";

const playfair = Playfair_Display({
  variable: "--font-playfair",
  subsets: ["latin"],
  display: "swap",
});

const karla = Karla({
  variable: "--font-karla",
  subsets: ["latin"],
  display: "swap",
});

/* Logo lockup fonts (see Wordmark): Bevan for "GLUTTONS", rounded Nunito for "garage". */
const bevan = Bevan({ variable: "--font-bevan", subsets: ["latin"], weight: "400", display: "swap" });
const nunito = Nunito({ variable: "--font-nunito", subsets: ["latin"], weight: "800", display: "swap" });

export const metadata: Metadata = {
  title: "Gluttons Garage · Fusion food & coffee on Beach Road, Vizag",
  description:
    "Gluttons Garage is a garage-themed cafe on Dr NTR Beach Road, Visakhapatnam: fusion food, speciality coffee and desserts, open daily from 8 AM.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${playfair.variable} ${karla.variable} ${bevan.variable} ${nunito.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        {children}
        <WhatsAppFab />
      </body>
    </html>
  );
}
