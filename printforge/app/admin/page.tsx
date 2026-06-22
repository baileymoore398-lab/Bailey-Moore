import Link from "next/link";
import { prisma } from "@/lib/db";
import { money } from "@/lib/utils";

export const dynamic = "force-dynamic";
export const metadata = { title: "Admin Dashboard" };

export default async function AdminDashboard() {
  const now = new Date();
  const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

  const [ordersToday, ordersMonth, revMonth, revAll, openOrders, customers, printers, pendingRequests, topRaw] =
    await Promise.all([
      prisma.order.count({ where: { createdAt: { gte: startOfDay } } }),
      prisma.order.count({ where: { createdAt: { gte: startOfMonth } } }),
      prisma.order.aggregate({ _sum: { total: true }, where: { paymentStatus: "PAID", createdAt: { gte: startOfMonth } } }),
      prisma.order.aggregate({ _sum: { total: true }, where: { paymentStatus: "PAID" } }),
      prisma.order.count({ where: { status: { notIn: ["DELIVERED", "CANCELLED"] } } }),
      prisma.user.count({ where: { role: "CUSTOMER" } }),
      prisma.printer.findMany(),
      prisma.customRequest.count({ where: { status: { in: ["NEW", "IN_REVIEW"] } } }),
      prisma.orderItem.groupBy({ by: ["productId"], _sum: { quantity: true, lineTotal: true }, where: { productId: { not: null } }, orderBy: { _sum: { lineTotal: "desc" } }, take: 5 })
    ]);

  const topProducts = await Promise.all(
    topRaw.map(async (r) => {
      const p = r.productId ? await prisma.product.findUnique({ where: { id: r.productId } }) : null;
      return { name: p?.name ?? "—", units: r._sum.quantity ?? 0, revenue: r._sum.lineTotal ?? 0 };
    })
  );

  const utilisation = printers.length ? Math.round((printers.filter((p) => p.status === "PRINTING").length / printers.length) * 100) : 0;
  const filament = printers.reduce((s, p) => s + p.filamentRemainingG, 0);

  return (
    <div>
      <h1 className="text-2xl font-bold">Dashboard</h1>

      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Metric label="Revenue (month)" value={money(revMonth._sum.total ?? 0)} accent />
        <Metric label="Revenue (all time)" value={money(revAll._sum.total ?? 0)} />
        <Metric label="Orders today" value={ordersToday} />
        <Metric label="Orders this month" value={ordersMonth} />
        <Metric label="Open orders" value={openOrders} />
        <Metric label="Customers" value={customers} />
        <Metric label="Printer utilisation" value={`${utilisation}%`} />
        <Metric label="Filament remaining" value={`${(filament / 1000).toFixed(1)} kg`} />
      </div>

      <div className="mt-8 grid gap-6 lg:grid-cols-2">
        <div className="card p-6">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold">Top products</h2>
            <Link href="/admin/orders" className="text-sm text-brand-700 hover:underline">All orders →</Link>
          </div>
          <table className="mt-4 w-full text-sm">
            <thead className="text-left text-slate-500">
              <tr><th className="py-2">Product</th><th className="py-2 text-right">Units</th><th className="py-2 text-right">Revenue</th></tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {topProducts.length === 0 && <tr><td className="py-3 text-slate-400" colSpan={3}>No sales yet</td></tr>}
              {topProducts.map((p, i) => (
                <tr key={i}><td className="py-2">{p.name}</td><td className="py-2 text-right">{p.units}</td><td className="py-2 text-right font-medium">{money(p.revenue)}</td></tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="card p-6">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold">Printer fleet</h2>
            <Link href="/admin/printers" className="text-sm text-brand-700 hover:underline">Manage →</Link>
          </div>
          <ul className="mt-4 space-y-2 text-sm">
            {printers.map((p) => (
              <li key={p.id} className="flex items-center justify-between">
                <span>{p.name}</span>
                <span className="flex items-center gap-2">
                  <span className="text-slate-400">{(p.successRate * 100).toFixed(0)}%</span>
                  <StatusDot status={p.status} />
                </span>
              </li>
            ))}
          </ul>
          {pendingRequests > 0 && (
            <Link href="/admin/requests" className="mt-4 block rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">
              {pendingRequests} custom request(s) need attention →
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}

function Metric({ label, value, accent }: { label: string; value: string | number; accent?: boolean }) {
  return (
    <div className={`card p-5 ${accent ? "bg-brand-600 text-white" : ""}`}>
      <div className="text-2xl font-bold">{value}</div>
      <div className={`text-sm ${accent ? "text-brand-100" : "text-slate-500"}`}>{label}</div>
    </div>
  );
}

function StatusDot({ status }: { status: string }) {
  const color = status === "PRINTING" ? "bg-green-500" : status === "IDLE" ? "bg-slate-300" : status === "MAINTENANCE" ? "bg-amber-500" : "bg-red-500";
  return <span className={`inline-block h-2.5 w-2.5 rounded-full ${color}`} title={status} />;
}
