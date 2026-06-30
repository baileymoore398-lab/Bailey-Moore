import Link from "next/link";
import { DONATE_URL } from "@/lib/site";
import { Logo } from "@/components/Logo";

export function SiteFooter() {
  return (
    <footer className="mt-20 border-t border-border/60">
      <div className="container-page flex flex-col items-center gap-3 py-8 text-center sm:flex-row sm:justify-between sm:text-left">
        <Link href="/" aria-label="RouteForge home">
          <Logo size="sm" showTrademark />
        </Link>
        <div className="flex flex-col items-center gap-3 sm:flex-row">
          <Link
            href="/contact"
            className="text-xs font-medium text-muted transition-colors hover:text-white"
          >
            Contact
          </Link>
          <a
            href={DONATE_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 rounded-lg border border-accent/40 bg-accent/10 px-3 py-1.5 text-xs font-semibold text-accent transition hover:bg-accent/20"
          >
            Support RouteForge
          </a>
          <p className="text-xs text-muted">
            AI race analysis &middot; built by{" "}
            <span className="font-medium text-white">Bailey&nbsp;Moore</span>{" "}
            &middot; &copy; {new Date().getFullYear()} RouteForge
          </p>
        </div>
      </div>
    </footer>
  );
}
