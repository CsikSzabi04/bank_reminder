import type { Metadata } from "next";
import { BRAND } from "@/lib/brand";
import "./globals.css";

export const metadata: Metadata = {
  title: BRAND.name,
};

// A tokenek, betű (Inter latin-ext), téma és i18n a B-02 / B-03 feladat
export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="hu" suppressHydrationWarning>
      <body>{children}</body>
    </html>
  );
}
