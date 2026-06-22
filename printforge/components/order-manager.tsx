"use client";

import { useState } from "react";
import { ORDER_STATUS_STEPS, statusLabel } from "@/lib/utils";

const carriers = [
  { value: "NZ_POST", label: "NZ Post" },
  { value: "ARAMEX_NZ", label: "Aramex NZ" },
  { value: "COURIER_POST", label: "CourierPost" }
];

export function OrderManager({ orderId, current }: { orderId: string; current: string }) {
  const [status, setStatus] = useState(current);
  const [carrier, setCarrier] = useState("NZ_POST");
  const [note, setNote] = useState("");
  const [paymentStatus, setPaymentStatus] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function update() {
    setBusy(true);
    setMsg(null);
    try {
      const body: Record<string, unknown> = { status, note: note || undefined };
      if (status === "SHIPPED") body.carrier = carrier;
      if (paymentStatus) body.paymentStatus = paymentStatus;
      const res = await fetch(`/api/orders/${orderId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body)
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Update failed");
      setMsg("Order updated.");
      setTimeout(() => window.location.reload(), 600);
    } catch (err) {
      setMsg(err instanceof Error ? err.message : "Failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="card space-y-4 p-6">
      <h2 className="font-semibold">Advance production</h2>
      <div>
        <label className="label">Status</label>
        <select className="input" value={status} onChange={(e) => setStatus(e.target.value)}>
          {[...ORDER_STATUS_STEPS, "CANCELLED"].map((s) => (
            <option key={s} value={s}>{statusLabel(s)}</option>
          ))}
        </select>
      </div>
      {status === "SHIPPED" && (
        <div>
          <label className="label">Carrier (generates tracking)</label>
          <select className="input" value={carrier} onChange={(e) => setCarrier(e.target.value)}>
            {carriers.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
          </select>
        </div>
      )}
      <div>
        <label className="label">Payment status</label>
        <select className="input" value={paymentStatus} onChange={(e) => setPaymentStatus(e.target.value)}>
          <option value="">No change</option>
          {["PENDING", "PAID", "REFUNDED", "FAILED"].map((p) => <option key={p}>{p}</option>)}
        </select>
      </div>
      <div>
        <label className="label">Note (optional)</label>
        <input className="input" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Internal/customer note" />
      </div>
      {msg && <p className="text-sm text-brand-700">{msg}</p>}
      <button className="btn-primary w-full" onClick={update} disabled={busy}>{busy ? "Updating…" : "Update order"}</button>
    </div>
  );
}
