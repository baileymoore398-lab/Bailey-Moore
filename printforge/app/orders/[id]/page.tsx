import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { money, statusLabel, ORDER_STATUS_STEPS, statusIndex } from "@/lib/utils";

export const dynamic = "force-dynamic";
export const metadata = { title: "Order tracking" };

export default async function OrderTrackingPage({ params }: { params: { id: string } }) {
  const order = await prisma.order.findFirst({
    where: { OR: [{ id: params.id }, { orderNumber: params.id }] },
    include: { items: true, history: { orderBy: { createdAt: "asc" } }, shippingAddress: true }
  });
  if (!order) notFound();

  const user = await getCurrentUser();
  const isStaff = user && (user.role === "ADMIN" || user.role === "OPERATOR");
  if (order.userId && order.userId !== user?.id && !isStaff) notFound();

  const currentIdx = order.status === "CANCELLED" ? -1 : statusIndex(order.status);

  return (
    <div className="mx-auto max-w-4xl px-4 py-12">
      <Link href="/dashboard" className="text-sm text-brand-700 hover:underline">← Back to dashboard</Link>
      <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Order {order.orderNumber}</h1>
          <p className="text-slate-500">Placed {new Date(order.createdAt).toLocaleDateString("en-NZ")}</p>
        </div>
        <span className="badge bg-brand-600 px-3 py-1 text-white">{statusLabel(order.status)}</span>
      </div>

      {/* Progress timeline */}
      <div className="card mt-8 p-6">
        <ol className="space-y-4">
          {ORDER_STATUS_STEPS.map((step, i) => {
            const reached = i <= currentIdx;
            const active = i === currentIdx;
            return (
              <li key={step} className="flex items-center gap-4">
                <span className={`grid h-8 w-8 place-items-center rounded-full text-xs font-bold ${reached ? "bg-brand-600 text-white" : "bg-slate-200 text-slate-400"} ${active ? "ring-4 ring-brand-100" : ""}`}>
                  {reached ? "✓" : i + 1}
                </span>
                <span className={reached ? "font-medium text-slate-900" : "text-slate-400"}>{statusLabel(step)}</span>
              </li>
            );
          })}
        </ol>
        {order.trackingNumber && (
          <div className="mt-6 rounded-lg bg-slate-50 p-4 text-sm">
            <p className="font-medium">Shipping: {order.carrier?.replace("_", " ")}</p>
            <p className="text-slate-600">Tracking: {order.trackingNumber}</p>
            {order.trackingUrl && <a href={order.trackingUrl} target="_blank" className="text-brand-700 underline">Track parcel →</a>}
          </div>
        )}
      </div>

      {/* Items + totals */}
      <div className="mt-8 grid gap-6 lg:grid-cols-2">
        <div className="card p-6">
          <h2 className="font-semibold">Items</h2>
          <ul className="mt-3 divide-y divide-slate-100 text-sm">
            {order.items.map((it) => (
              <li key={it.id} className="flex items-center justify-between py-2">
                <span>{it.description} × {it.quantity}</span>
                <span className="font-medium">{money(it.lineTotal)}</span>
              </li>
            ))}
          </ul>
          <dl className="mt-4 space-y-1 border-t border-slate-100 pt-4 text-sm">
            <Row label="Subtotal" value={money(order.subtotal)} />
            {order.discount > 0 && <Row label="Discount" value={`-${money(order.discount)}`} />}
            <Row label="Shipping" value={money(order.shipping)} />
            <Row label="GST" value={money(order.gst)} />
            <div className="flex justify-between border-t border-slate-100 pt-2 font-bold">
              <span>Total</span><span>{money(order.total)}</span>
            </div>
          </dl>
        </div>

        <div className="card p-6">
          <h2 className="font-semibold">Activity</h2>
          <ul className="mt-3 space-y-3 text-sm">
            {order.history.map((h) => (
              <li key={h.id} className="flex gap-3">
                <span className="text-slate-400">{new Date(h.createdAt).toLocaleString("en-NZ")}</span>
                <span className="font-medium">{statusLabel(h.status)}</span>
                {h.note && <span className="text-slate-500">— {h.note}</span>}
              </li>
            ))}
          </ul>
          <div className="mt-4 text-sm">
            <span className="badge bg-slate-100 text-slate-600">Payment: {order.paymentStatus}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between">
      <dt className="text-slate-500">{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}
