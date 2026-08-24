import type { Metadata } from "next";
import { Roboto } from "next/font/google";
import SiteHeader from "@/components/site/SiteHeader";
import SiteFooter from "@/components/site/SiteFooter";
import "./globals.css";

/* One typeface across the whole site. Small labels are set by size,
   weight and tracking rather than by switching to a second family. */
const roboto = Roboto({
  subsets: ["latin"],
  weight: ["400", "500", "700"],
  variable: "--font-roboto",
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL("https://allclearsafety.ca"),
  title: {
    default: "All Clear — automated PPE compliance records for Alberta sites",
    template: "%s — All Clear",
  },
  description:
    "Most operators run safe sites but cannot prove it. All Clear turns the cameras already on your worksite into a timestamped PPE compliance record — the documentation COR certification and your WCB standing depend on.",
  openGraph: {
    type: "website",
    siteName: "All Clear",
    locale: "en_CA",
  },
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en-CA" className={roboto.variable}>
      <body className="flex min-h-screen flex-col">
        <a
          href="#main"
          className="label sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-[60] focus:bg-accent focus:px-5 focus:py-3 focus:text-cream"
        >
          Skip to content
        </a>
        <SiteHeader />
        <main id="main" className="flex-1">
          {children}
        </main>
        <SiteFooter />
      </body>
    </html>
  );
}
