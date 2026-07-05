"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import { clearSession, getSessionUser, type SessionUser } from "@/lib/auth";
import { DONATE_URL } from "@/lib/site";
import { Logo } from "@/components/Logo";
import { TutorialButton } from "@/components/Tutorial";

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
  const [menuOpen, setMenuOpen] = useState(false);

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

  // Close the mobile menu whenever the route changes.
  useEffect(() => {
    setMenuOpen(false);
  }, [pathname]);

  const logout = () => {
    clearSession();
    setMenuOpen(false);
    router.push("/login");
  };

  // Public share / embed routes render chrome-free for clean previews + iframes.
  if (pathname.startsWith("/s/") || pathname.startsWith("/embed/")) {
    return null;
  }

  const isActive = (href: string) =>
    pathname === href || pathname.startsWith(href + "/");

  return (
    <header className="fixed inset-x-0 top-0 z-50 border-b border-border/60 bg-bg/70 backdrop-blur-xl after:pointer-events-none after:absolute after:inset-x-0 after:bottom-[-1px] after:h-px after:bg-gradient-to-r after:from-transparent after:via-accent/40 after:to-transparent">
      <div className="container-page flex h-16 items-center justify-between">
        <Link href="/" aria-label="RouteForge home">
          <Logo size="md" />
        </Link>

        {/* Desktop nav */}
        <nav className="flex items-center gap-1">
          {links.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className={cn(
                "relative hidden rounded-lg px-3 py-2 text-sm font-medium transition-colors sm:block",
                isActive(l.href) ? "text-accent" : "text-muted hover:text-white"
              )}
            >
              {l.label}
              {isActive(l.href) && (
                <motion.span
                  layoutId="nav-active-underline"
                  className="absolute inset-x-3 bottom-0.5 h-0.5 rounded-full bg-accent/70"
                  transition={{ type: "spring", stiffness: 400, damping: 32 }}
                />
              )}
            </Link>
          ))}
          <TutorialButton
            autoOpen
            className="hidden rounded-lg px-3 py-2 text-sm font-medium text-muted transition-colors hover:text-accent sm:block"
          />
          <a
            href={DONATE_URL}
            target="_blank"
            rel="noopener noreferrer"
            title="Support RouteForge"
            className="mr-1 hidden items-center gap-1 rounded-lg px-3 py-2 text-sm font-medium text-muted transition-colors hover:text-accent lg:inline-flex"
          >
            Support
          </a>
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
                className="hidden rounded-lg px-3 py-2 text-sm font-medium text-muted transition-colors hover:text-white sm:block"
              >
                Sign out
              </button>
            </>
          ) : (
            <>
              <Link
                href="/login"
                className="hidden rounded-lg px-3 py-2 text-sm font-medium text-muted hover:text-white sm:block"
              >
                Sign in
              </Link>
              <Link
                href="/register"
                className="ml-1 hidden rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-bg transition hover:bg-accent/90 sm:block"
              >
                Get started
              </Link>
            </>
          )}

          {/* Mobile hamburger */}
          <button
            onClick={() => setMenuOpen((v) => !v)}
            aria-label={menuOpen ? "Close menu" : "Open menu"}
            aria-expanded={menuOpen}
            className="grid h-10 w-10 place-items-center rounded-lg text-white transition hover:bg-bg-elevated/60 sm:hidden"
          >
            <span className="relative block h-3.5 w-5">
              <span
                className={cn(
                  "absolute left-0 top-0 h-0.5 w-5 rounded bg-current transition-transform",
                  menuOpen && "translate-y-1.5 rotate-45"
                )}
              />
              <span
                className={cn(
                  "absolute left-0 top-1.5 h-0.5 w-5 rounded bg-current transition-opacity",
                  menuOpen && "opacity-0"
                )}
              />
              <span
                className={cn(
                  "absolute left-0 top-3 h-0.5 w-5 rounded bg-current transition-transform",
                  menuOpen && "-translate-y-1.5 -rotate-45"
                )}
              />
            </span>
          </button>
        </nav>
      </div>

      {/* Mobile menu panel (anchored to the fixed header, solid background). */}
      <AnimatePresence>
        {menuOpen && (
          <motion.div
            key="mobile-menu"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.24, ease: "easeInOut" }}
            className="overflow-hidden border-t border-border/60 bg-bg sm:hidden"
          >
          <nav className="container-page flex flex-col gap-1 py-3">
            {links.map((l) => (
              <Link
                key={l.href}
                href={l.href}
                onClick={() => setMenuOpen(false)}
                className={cn(
                  "rounded-lg px-3 py-2.5 text-base font-medium transition-colors",
                  isActive(l.href)
                    ? "bg-accent/10 text-accent"
                    : "text-white hover:bg-bg-elevated/60"
                )}
              >
                {l.label}
              </Link>
            ))}
            <div className="my-2 border-t border-border/60" />
            <TutorialButton
              label="Tutorial"
              className="rounded-lg px-3 py-2.5 text-left text-base font-medium text-muted transition-colors hover:text-white"
            />
            <a
              href={DONATE_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-lg px-3 py-2.5 text-base font-medium text-muted transition-colors hover:text-white"
            >
              Support RouteForge
            </a>
            {user ? (
              <>
                <Link
                  href="/settings"
                  onClick={() => setMenuOpen(false)}
                  className="rounded-lg px-3 py-2.5 text-base font-medium text-muted hover:text-white"
                >
                  Settings
                </Link>
                <button
                  onClick={logout}
                  className="rounded-lg px-3 py-2.5 text-left text-base font-medium text-muted transition-colors hover:text-white"
                >
                  Sign out
                </button>
              </>
            ) : (
              <div className="mt-1 flex gap-2 px-3 pb-2">
                <Link
                  href="/login"
                  onClick={() => setMenuOpen(false)}
                  className="flex-1 rounded-lg border border-border px-4 py-2.5 text-center text-sm font-semibold text-white transition hover:border-accent"
                >
                  Sign in
                </Link>
                <Link
                  href="/register"
                  onClick={() => setMenuOpen(false)}
                  className="flex-1 rounded-lg bg-accent px-4 py-2.5 text-center text-sm font-semibold text-bg transition hover:bg-accent/90"
                >
                  Get started
                </Link>
              </div>
            )}
          </nav>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  );
}
