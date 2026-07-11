"use client";

import { MotionConfig } from "framer-motion";
import { usePathname } from "next/navigation";
import { SiteNav } from "@/components/SiteNav";
import { SiteFooter } from "@/components/SiteFooter";

// Renders the global nav + content padding for app routes, but renders public
// share/embed routes chrome-free (no nav, no top padding) for clean previews
// and iframe embeds. MotionConfig makes every Framer Motion animation honor the
// user's "reduce motion" OS setting.
export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const chromeless =
    pathname.startsWith("/s/") || pathname.startsWith("/embed/");

  return (
    <MotionConfig reducedMotion="user">
      {chromeless ? (
        <main>{children}</main>
      ) : (
        <>
          <SiteNav />
          <main className="pt-16">{children}</main>
          <SiteFooter />
        </>
      )}
    </MotionConfig>
  );
}
