import type { Metadata } from "next";
import { Roboto, Roboto_Mono } from "next/font/google";
import SiteHeader from "@/components/site/SiteHeader";
import SiteFooter from "@/components/site/SiteFooter";
import "./globals.css";

const roboto = Roboto({
  subsets: ["latin"],
  weight: ["300", "400", "500", "700"],
  variable: "--font-roboto",
  display: "swap",
});

const robotoMono = Roboto_Mono({
  subsets: ["latin"],
  weight: ["400", "500"],
  variable: "--font-roboto-mono",
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL("https://allclearsafety.ca"),
  title: {
    default: "All Clear — PPE compliance recording for Alberta sites",
    template: "%s — All Clear",
  },
  description:
    "All Clear watches the cameras already on your worksite, detects a missing hard hat or hi-vis vest, and writes each one to a timestamped compliance record.",
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
    <html
      lang="en-CA"
      className={`${roboto.variable} ${robotoMono.variable}`}
    >
      <body className="flex min-h-screen flex-col">
        <a
          href="#main"
          className="label-mono sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-[60] focus:bg-navy focus:px-5 focus:py-3 focus:text-cream"
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
