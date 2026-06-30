import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import "maplibre-gl/dist/maplibre-gl.css";
import { AppShell } from "@/components/AppShell";
import { SITE_NAME, SITE_URL } from "@/lib/site";

const inter = Inter({ subsets: ["latin"], variable: "--font-sans" });

const description =
  "Turn a photo of your map and a GPS track into deep race analysis, mistake detection, and an AI coach report — for orienteers, MTBO riders, rogainers and trail runners.";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: `${SITE_NAME} — AI Race Analysis`,
    template: `%s — ${SITE_NAME}`,
  },
  description,
  applicationName: SITE_NAME,
  keywords: [
    "orienteering",
    "race analysis",
    "GPS analysis",
    "MTBO",
    "rogaining",
    "trail running",
    "route choice",
    "AI coach",
  ],
  icons: { icon: "/icon.svg", apple: "/logo-mark.svg" },
  openGraph: {
    type: "website",
    siteName: SITE_NAME,
    title: `${SITE_NAME} — AI Race Analysis`,
    description,
    url: SITE_URL,
    images: [
      { url: "/og.png", width: 1200, height: 630, alt: `${SITE_NAME} — AI race analysis` },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: `${SITE_NAME} — AI Race Analysis`,
    description,
    images: ["/og.png"],
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`${inter.variable} dark`}>
      <body className="min-h-screen font-sans">
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}
