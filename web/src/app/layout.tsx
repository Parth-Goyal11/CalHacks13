import type { Metadata, Viewport } from "next";
import "./globals.css";
import "./yonder-polish.css";
import "./sky-reveal.css";

export const metadata: Metadata = {
  title: "Yonder",
  description:
    "A little of tonight, kept forever. Capture your sky, discover what is in it, and keep your nights in Memories.",
};

export const viewport: Viewport = {
  themeColor: "#05070d",
  viewportFit: "cover",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" style={{ colorScheme: "dark", background: "#03050a" }}>
      <body>{children}</body>
    </html>
  );
}
