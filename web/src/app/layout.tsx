import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Link from "next/link";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "SkyScore — Photograph space events",
  description:
    "Hunt celestial events by rarity and distance, then photograph them for points.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <nav className="flex items-center gap-4 border-b border-zinc-900 px-4 py-3 text-sm text-zinc-400 sm:px-6">
          <Link
            href="/"
            className="font-medium tracking-tight text-zinc-100 hover:text-white"
          >
            SkyScore
          </Link>
          <Link href="/events" className="hover:text-zinc-200">
            Events
          </Link>
          <Link href="/sky" className="hover:text-zinc-200">
            Capture
          </Link>
        </nav>
        {children}
      </body>
    </html>
  );
}
