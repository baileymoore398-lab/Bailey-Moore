import type { Metadata } from "next";
import "./globals.css";
import { SiteNav } from "@/components/site-nav";
import { SiteFooter } from "@/components/site-footer";

export const metadata: Metadata = {
  title: {
    default: "PrintForge NZ — 3D Printing Marketplace & Manufacturing",
    template: "%s · PrintForge NZ"
  },
  description:
    "Upload your STL, STEP, OBJ or 3MF for an instant quote. Custom CAD design, 3D printing and manufacturing across New Zealand. PLA, PETG, TPU, ABS, ASA, Nylon and Carbon Fibre Nylon.",
  keywords: [
    "3D printing NZ", "instant quote", "STL printing", "custom CAD", "PETG", "carbon fibre nylon", "New Zealand 3D printing"
  ],
  openGraph: {
    title: "PrintForge NZ",
    description: "Instant 3D printing quotes and custom manufacturing in New Zealand.",
    type: "website",
    locale: "en_NZ"
  },
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || "https://printforge.nz")
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en-NZ">
      <body>
        <SiteNav />
        <main className="min-h-[70vh]">{children}</main>
        <SiteFooter />
      </body>
    </html>
  );
}
