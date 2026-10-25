import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = { title: "Camera - Yonder" };

export default function CaptureLayout({ children }: { children: ReactNode }) {
  return children;
}
