import type { Metadata } from "next";
import "./globals.css";

// Authentication and configuration are evaluated at runtime, including after a hosting restart.
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Valiantum Marketing OS",
  description: "Private multi-brand marketing operations platform",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
