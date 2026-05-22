import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "WK 2026 Pronostiek",
  description: "Voorspel de uitslagen van het WK 2026 en win!",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="nl">
      <body>{children}</body>
    </html>
  );
}
