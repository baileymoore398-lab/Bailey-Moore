import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import "maplibre-gl/dist/maplibre-gl.css";
import { SiteNav } from "@/components/SiteNav";

const inter = Inter({ subsets: ["latin"], variable: "--font-sans" });

export const metadata: Metadata = {
  title: "RouteForge — AI Race Analysis",
  description:
    "Turn a photo of your map and a GPS track into deep race analysis, mistake detection, and an AI coach report.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`${inter.variable} dark`}>
      <body className="min-h-screen font-sans">
        <SiteNav />
        <main className="pt-16">{children}</main>
      </body>
    </html>
  );
}
