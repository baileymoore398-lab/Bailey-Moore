import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { money, statusLabel } from "@/lib/utils";
import { LogoutButton } from "@/components/logout-button";

export const dynamic = "force-dynamic";
export const metadata = { title: "Dashboard" };

export default async function DashboardPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const [orders, projects, fullUser] = await Promise.all([
    prisma.order.findMany({ where: { userId: user.id }, orderBy: { createdAt: "desc" }, include: { items: true } }),
    prisma.project.findMany({ where: { userId: user.id }, orderBy: { createdAt: "desc" }, take: 6, include: { quotes: true } }),
    prisma.user.findUnique({ where: { id: user.id } })
  ]);

  return (
    <div className="mx-auto max-w-6xl px-4 py-12">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">Hi {user.name?.split(" ")[0] ?? "there"}</h1>
          <p className="text-slate-500">{user.email}</p>
        </div>
        <div className="flex items-center gap-3">
          <span className="badge bg-forge-500 text-white">{fullUser?.loyaltyPoints ?? 0} loyalty points</span>
          <LogoutButton />
        </div>
      </div>

      {/* Stats */}
      <div className="mt-8 grid gap-4 sm:grid-cols-3">
        <Stat label="Orders" value={orders.length} />
        <Stat label="Saved projects" value={projects.length} />
        <Stat label="Referral code" value={fullUser?.referralCode ?? "—"} />
      </div>

      {/* Orders */}
      <section className="mt-10">
        <h2 className="text-xl font-bold">Order history</h2>
        {orders.length === 0 ? (
          <p className="mt-3 text-slate-500">No orders yet. <Link href="/quote" className="text-brand-700 underline">Get a quote</Link>.</p>
        ) : (
          <div className="mt-4 overflow-hidden rounded-xl border border-slate-200">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-left text-slate-500">
                <tr>
                  <th className="px-4 py-3">Order</th>
                  <th className="px-4 py-3">Date</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3 text-right">Total</th>
                  <th />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {orders.map((o) => (
                  <tr key={o.id}>
                    <td className="px-4 py-3 font-mono text-xs">{o.orderNumber}</td>
                    <td className="px-4 py-3">{new Date(o.createdAt).toLocaleDateString("en-NZ")}</td>
                    <td className="px-4 py-3"><span className="badge bg-brand-50 text-brand-700">{statusLabel(o.status)}</span></td>
                    <td className="px-4 py-3 text-right font-medium">{money(o.total)}</td>
                    <td className="px-4 py-3 text-right"><Link href={`/orders/${o.id}`} className="text-brand-700 hover:underline">Track</Link></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Projects */}
      <section className="mt-10">
        <h2 className="text-xl font-bold">Saved projects</h2>
        {projects.length === 0 ? (
          <p className="mt-3 text-slate-500">Quotes you generate are saved here.</p>
        ) : (
          <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {projects.map((p) => (
              <div key={p.id} className="card p-4">
                <h3 className="truncate font-medium">{p.name}</h3>
                <p className="mt-1 text-xs text-slate-500">{p.quotes.length} quote(s)</p>
                {p.quotes[0] && <p className="mt-2 font-bold text-brand-700">{money(p.quotes[0].total)}</p>}
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="card p-5">
      <div className="text-2xl font-bold">{value}</div>
      <div className="text-sm text-slate-500">{label}</div>
    </div>
  );
}
