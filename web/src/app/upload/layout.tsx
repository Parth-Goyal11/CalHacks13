import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = { title: "Your Sky - Capture" };

export default function CaptureLayout({ children }: { children: ReactNode }) {
  return children;
}
