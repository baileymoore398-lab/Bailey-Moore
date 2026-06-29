import Link from "next/link";
import { DONATE_URL } from "@/lib/site";

export function SiteFooter() {
  return (
    <footer className="mt-20 border-t border-border/60">
      <div className="container-page flex flex-col items-center gap-3 py-8 text-center sm:flex-row sm:justify-between sm:text-left">
        <Link href="/" className="flex items-center gap-2">
          <span className="grid h-6 w-6 place-items-center rounded-md bg-accent text-bg text-xs font-black">
            R
          </span>
          <span className="text-sm font-bold tracking-tight">
            Route<span className="text-accent">Forge</span>
            <span className="align-super text-[9px] text-muted">™</span>
          </span>
        </Link>
        <div className="flex flex-col items-center gap-3 sm:flex-row">
          <a
            href={DONATE_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 rounded-lg border border-accent/40 bg-accent/10 px-3 py-1.5 text-xs font-semibold text-accent transition hover:bg-accent/20"
          >
            <span aria-hidden>❤</span> Support RouteForge
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
