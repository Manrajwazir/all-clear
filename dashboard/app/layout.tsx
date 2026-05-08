import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { BGPattern } from "@/components/ui/bg-pattern";
import "./globals.css";

const geist = Geist({
  subsets: ["latin"],
  variable: "--font-geist",
  display: "swap",
});

const geistMono = Geist_Mono({
  subsets: ["latin"],
  variable: "--font-geist-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: "All Clear — Operations Console",
  description: "Real-time PPE violation monitoring for construction sites.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${geist.variable} ${geistMono.variable}`}>
      <body className="text-text-primary antialiased">
        <BGPattern variant="grid" mask="fade-edges" size={32} fill="#1A1D26" />
        <div className="relative z-10">{children}</div>
      </body>
    </html>
  );
}
