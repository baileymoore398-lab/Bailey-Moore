"use client";

import { usePathname } from "next/navigation";
import { SiteNav } from "@/components/SiteNav";

// Renders the global nav + content padding for app routes, but renders public
// share/embed routes chrome-free (no nav, no top padding) for clean previews
// and iframe embeds.
export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const chromeless =
    pathname.startsWith("/s/") || pathname.startsWith("/embed/");

  if (chromeless) {
    return <main>{children}</main>;
  }
  return (
    <>
      <SiteNav />
      <main className="pt-16">{children}</main>
    </>
  );
}
