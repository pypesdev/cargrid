import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "cargrid",
  description: "Local-first analytics over public automobile transaction data.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
