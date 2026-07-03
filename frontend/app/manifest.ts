import type { MetadataRoute } from "next";
import { SITE_NAME } from "@/lib/site";

// Web app manifest — lets users install RouteForge to their home screen.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: `${SITE_NAME} — AI Race Analysis`,
    short_name: SITE_NAME,
    description:
      "Turn a photo of your map and a GPS track into deep race analysis, mistake detection, and an AI coach report.",
    start_url: "/dashboard",
    display: "standalone",
    background_color: "#0c0e0a",
    theme_color: "#0c0e0a",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png" },
      {
        src: "/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
