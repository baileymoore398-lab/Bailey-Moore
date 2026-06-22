import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

const nav = [
  { href: "/admin", label: "Dashboard" },
  { href: "/admin/orders", label: "Orders" },
  { href: "/admin/printers", label: "Printers" },
  { href: "/admin/requests", label: "Custom Requests" }
];

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (user.role !== "ADMIN" && user.role !== "OPERATOR") redirect("/dashboard");

  return (
    <div className="mx-auto flex max-w-7xl gap-6 px-4 py-8">
      <aside className="hidden w-52 shrink-0 lg:block">
        <div className="sticky top-20 space-y-1">
          <p className="px-3 pb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">Manufacturing</p>
          {nav.map((n) => (
            <Link key={n.href} href={n.href} className="block rounded-lg px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 hover:text-slate-900">
              {n.label}
            </Link>
          ))}
        </div>
      </aside>
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}
