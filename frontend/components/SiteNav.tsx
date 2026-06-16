"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import { clearSession, getSessionUser, type SessionUser } from "@/lib/auth";

const links = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/upload", label: "Analyze" },
  { href: "/events", label: "Events" },
  { href: "/coach", label: "Coach" },
  { href: "/clubs", label: "Clubs" },
  { href: "/training", label: "Training" },
];

export function SiteNav() {
  const pathname = usePathname();
  const router = useRouter();
  const [user, setUser] = useState<SessionUser | null>(null);

  useEffect(() => {
    const sync = () => setUser(getSessionUser());
    sync();
    window.addEventListener("rf-auth-change", sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener("rf-auth-change", sync);
      window.removeEventListener("storage", sync);
    };
  }, []);

  const logout = () => {
    clearSession();
    router.push("/login");
  };

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
                  "hidden rounded-lg px-3 py-2 text-sm font-medium transition-colors sm:block",
                  active ? "text-accent" : "text-muted hover:text-white"
                )}
              >
                {l.label}
              </Link>
            );
          })}
          {user ? (
            <>
              <Link
                href="/settings"
                className="ml-2 hidden rounded-lg px-3 py-2 text-sm font-medium text-muted hover:text-white md:block"
              >
                Settings
              </Link>
              <button
                onClick={logout}
                className="rounded-lg px-3 py-2 text-sm font-medium text-muted transition-colors hover:text-white"
              >
                Sign out
              </button>
            </>
          ) : (
            <>
              <Link
                href="/login"
                className="rounded-lg px-3 py-2 text-sm font-medium text-muted hover:text-white"
              >
                Sign in
              </Link>
              <Link
                href="/register"
                className="ml-1 rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-bg transition hover:bg-accent/90"
              >
                Get started
              </Link>
            </>
          )}
        </nav>
      </div>
    </header>
  );
}
