"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const links = [
  { href: "/upload", label: "Analyze" },
  { href: "/races", label: "Races" },
  { href: "/athletes/me", label: "Profile" },
];

export function SiteNav() {
  const pathname = usePathname();
  return (
    <header className="fixed inset-x-0 top-0 z-50 border-b border-border/60 bg-bg/70 backdrop-blur-xl">
      <div className="container-page flex h-16 items-center justify-between">
        <Link href="/" className="flex items-center gap-2">
          <span className="grid h-8 w-8 place-items-center rounded-lg bg-accent text-bg font-black">
            R
          </span>
          <span className="text-lg font-bold tracking-tight">
            Route<span className="text-accent">Forge</span>
          </span>
        </Link>
        <nav className="flex items-center gap-1">
          {links.map((l) => {
            const active =
              pathname === l.href || pathname.startsWith(l.href + "/");
            return (
              <Link
                key={l.href}
                href={l.href}
                className={cn(
                  "rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                  active ? "text-accent" : "text-muted hover:text-white"
                )}
              >
                {l.label}
              </Link>
            );
          })}
          <Link
            href="/upload"
            className="ml-2 rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-bg transition hover:bg-accent/90"
          >
            New Analysis
          </Link>
        </nav>
      </div>
    </header>
  );
}
