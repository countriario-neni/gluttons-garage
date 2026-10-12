import type { Metadata, Viewport } from "next";
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

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://portfolio.hirerockysolutions.com/gluttons-garage";
const description =
  "Gluttons Garage is a garage-themed cafe on Dr NTR Beach Road, Visakhapatnam: fusion food, speciality coffee and desserts, open daily from 8 AM.";

export const metadata: Metadata = {
  // Trailing slash so relative URLs resolve under the /gluttons-garage/ base path.
  metadataBase: new URL(siteUrl.endsWith("/") ? siteUrl : `${siteUrl}/`),
  title: {
    default: "Gluttons Garage · Fusion food & coffee on Beach Road, Vizag",
    template: "%s · Gluttons Garage",
  },
  description,
  // Pitch demo: keep it out of search results.
  robots: { index: false, follow: false },
  openGraph: {
    type: "website",
    siteName: "Gluttons Garage",
    title: "Gluttons Garage · Fusion food & coffee on Beach Road, Vizag",
    description,
    images: [{ url: "images/hero/dining-room-gear-mural-1280.webp", width: 1080, height: 1440, alt: "The gear mural dining room at Gluttons Garage" }],
  },
};

export const viewport: Viewport = { themeColor: "#5a1f1b" };

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
