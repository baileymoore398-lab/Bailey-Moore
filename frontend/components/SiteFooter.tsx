import Link from "next/link";

export function SiteFooter() {
  return (
    <footer className="mt-20 border-t border-border/60">
      <div className="container-page flex flex-col items-center gap-2 py-8 text-center sm:flex-row sm:justify-between sm:text-left">
        <Link href="/" className="flex items-center gap-2">
          <span className="grid h-6 w-6 place-items-center rounded-md bg-accent text-bg text-xs font-black">
            R
          </span>
          <span className="text-sm font-bold tracking-tight">
            Route<span className="text-accent">Forge</span>
            <span className="align-super text-[9px] text-muted">™</span>
          </span>
        </Link>
        <p className="text-xs text-muted">
          AI race analysis &middot; built by{" "}
          <span className="font-medium text-white">Bailey&nbsp;Moore</span>{" "}
          &middot; &copy; {new Date().getFullYear()} RouteForge
        </p>
      </div>
    </footer>
  );
}
