import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/site";

// Public, indexable routes only — no account-specific pages.
const ROUTES = [
  { path: "/", priority: 1.0 },
  { path: "/pricing", priority: 0.8 },
  { path: "/contact", priority: 0.6 },
  { path: "/login", priority: 0.5 },
  { path: "/register", priority: 0.6 },
  { path: "/privacy", priority: 0.3 },
  { path: "/terms", priority: 0.3 },
];

export default function sitemap(): MetadataRoute.Sitemap {
  const lastModified = new Date("2026-06-30");
  return ROUTES.map((r) => ({
    url: `${SITE_URL}${r.path}`,
    lastModified,
    changeFrequency: "monthly",
    priority: r.priority,
  }));
}
