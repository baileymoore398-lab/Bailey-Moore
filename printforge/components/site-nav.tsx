import Link from "next/link";
import { getCurrentUser } from "@/lib/auth";

const links = [
  { href: "/quote", label: "Instant Quote" },
  { href: "/products", label: "Store" },
  { href: "/materials", label: "Materials" },
  { href: "/custom-request", label: "Custom Design" },
  { href: "/ai-assistant", label: "AI Assistant" },
  { href: "/track", label: "Track Order" }
];

export async function SiteNav() {
  const user = await getCurrentUser();
  const isStaff = user?.role === "ADMIN" || user?.role === "OPERATOR";

  return (
    <header className="sticky top-0 z-40 border-b border-slate-200 bg-white/90 backdrop-blur">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-3">
        <Link href="/" className="flex items-center gap-2 font-extrabold tracking-tight">
          <span className="grid h-8 w-8 place-items-center rounded-lg bg-brand-600 text-white">PF</span>
          <span className="text-lg">
            PrintForge <span className="text-forge-500">NZ</span>
          </span>
        </Link>

        <nav className="hidden items-center gap-1 lg:flex">
          {links.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className="rounded-lg px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 hover:text-slate-900"
            >
              {l.label}
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-2">
          {isStaff && (
            <Link href="/admin" className="hidden text-sm font-semibold text-brand-700 hover:underline sm:block">
              Admin
            </Link>
          )}
          {user ? (
            <Link href="/dashboard" className="btn-ghost">
              {user.name?.split(" ")[0] ?? "Dashboard"}
            </Link>
          ) : (
            <>
              <Link href="/login" className="hidden text-sm font-medium text-slate-600 hover:text-slate-900 sm:block">
                Sign in
              </Link>
              <Link href="/quote" className="btn-accent">
                Get a quote
              </Link>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
