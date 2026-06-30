import Link from "next/link";

/** Shared shell for long-form legal/prose pages (Privacy, Terms). */
export function LegalLayout({
  title,
  updated,
  children,
}: {
  title: string;
  updated: string;
  children: React.ReactNode;
}) {
  return (
    <div className="container-page py-12">
      <div className="mx-auto max-w-3xl">
        <Link
          href="/"
          className="text-sm text-muted transition-colors hover:text-accent"
        >
          ← Back to RouteForge
        </Link>
        <h1 className="mt-4 text-3xl font-black tracking-tight sm:text-4xl">
          {title}
        </h1>
        <p className="mt-2 text-sm text-muted">Last updated: {updated}</p>
        <div className="legal-prose mt-8 space-y-6 text-sm leading-relaxed text-white/85">
          {children}
        </div>
      </div>
    </div>
  );
}

/** A titled section within a legal page. */
export function LegalSection({
  heading,
  children,
}: {
  heading: string;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-2">
      <h2 className="text-lg font-bold text-white">{heading}</h2>
      <div className="space-y-2">{children}</div>
    </section>
  );
}
