import Link from "next/link";
import { prisma } from "@/lib/db";
import { money, statusLabel } from "@/lib/utils";

export const dynamic = "force-dynamic";
export const metadata = { title: "Admin · Orders" };

export default async function AdminOrders() {
  const orders = await prisma.order.findMany({
    orderBy: { createdAt: "desc" },
    take: 100,
    include: { user: { select: { email: true, name: true } }, items: true }
  });

  return (
    <div>
      <h1 className="text-2xl font-bold">Orders</h1>
      <div className="card mt-6 overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-slate-500">
            <tr>
              <th className="px-4 py-3">Order</th>
              <th className="px-4 py-3">Customer</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Payment</th>
              <th className="px-4 py-3 text-right">Total</th>
              <th />
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {orders.length === 0 && <tr><td className="px-4 py-6 text-slate-400" colSpan={6}>No orders yet</td></tr>}
            {orders.map((o) => (
              <tr key={o.id}>
                <td className="px-4 py-3 font-mono text-xs">{o.orderNumber}</td>
                <td className="px-4 py-3">{o.user?.email ?? "Guest"}</td>
                <td className="px-4 py-3"><span className="badge bg-brand-50 text-brand-700">{statusLabel(o.status)}</span></td>
                <td className="px-4 py-3"><span className="badge bg-slate-100 text-slate-600">{o.paymentStatus}</span></td>
                <td className="px-4 py-3 text-right font-medium">{money(o.total)}</td>
                <td className="px-4 py-3 text-right"><Link href={`/admin/orders/${o.id}`} className="text-brand-700 hover:underline">Manage</Link></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
