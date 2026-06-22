import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { money, statusLabel } from "@/lib/utils";
import { OrderManager } from "@/components/order-manager";

export const dynamic = "force-dynamic";

export default async function AdminOrderDetail({ params }: { params: { id: string } }) {
  const order = await prisma.order.findUnique({
    where: { id: params.id },
    include: { items: true, history: { orderBy: { createdAt: "asc" } }, user: true, shippingAddress: true }
  });
  if (!order) notFound();

  return (
    <div>
      <h1 className="text-2xl font-bold">Order {order.orderNumber}</h1>
      <p className="text-slate-500">{order.user?.email ?? "Guest"} · {new Date(order.createdAt).toLocaleString("en-NZ")}</p>

      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <div className="card p-6 lg:col-span-2">
          <h2 className="font-semibold">Items</h2>
          <ul className="mt-3 divide-y divide-slate-100 text-sm">
            {order.items.map((it) => (
              <li key={it.id} className="flex justify-between py-2">
                <span>{it.description} × {it.quantity}</span>
                <span className="font-medium">{money(it.lineTotal)}</span>
              </li>
            ))}
          </ul>
          <div className="mt-4 flex justify-between border-t border-slate-100 pt-3 font-bold">
            <span>Total</span><span>{money(order.total)}</span>
          </div>

          <h2 className="mt-8 font-semibold">History</h2>
          <ul className="mt-3 space-y-2 text-sm">
            {order.history.map((h) => (
              <li key={h.id} className="flex gap-3">
                <span className="text-slate-400">{new Date(h.createdAt).toLocaleString("en-NZ")}</span>
                <span className="font-medium">{statusLabel(h.status)}</span>
                {h.note && <span className="text-slate-500">— {h.note}</span>}
              </li>
            ))}
          </ul>
        </div>

        <OrderManager orderId={order.id} current={order.status} />
      </div>
    </div>
  );
}
