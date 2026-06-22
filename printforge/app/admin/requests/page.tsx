import { prisma } from "@/lib/db";
import { money } from "@/lib/utils";

export const dynamic = "force-dynamic";
export const metadata = { title: "Admin · Custom Requests" };

export default async function AdminRequests() {
  const requests = await prisma.customRequest.findMany({
    orderBy: { createdAt: "desc" },
    include: { user: { select: { email: true, name: true } } }
  });

  return (
    <div>
      <h1 className="text-2xl font-bold">Custom Requests</h1>
      <div className="mt-6 space-y-4">
        {requests.length === 0 && <p className="text-slate-500">No custom requests yet.</p>}
        {requests.map((r) => (
          <div key={r.id} className="card p-5">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <h2 className="font-semibold">{r.title}</h2>
                <p className="text-xs text-slate-500">
                  {r.category ?? "Uncategorised"} · {r.contactEmail ?? r.user?.email ?? "no email"} · {new Date(r.createdAt).toLocaleDateString("en-NZ")}
                </p>
              </div>
              <span className="badge bg-brand-50 text-brand-700">{r.status}</span>
            </div>
            <p className="mt-3 whitespace-pre-wrap text-sm text-slate-600">{r.description}</p>
            {(r.priceEstimate || r.timelineDays) && (
              <div className="mt-3 flex gap-3 text-sm">
                {r.priceEstimate != null && <span className="badge bg-green-50 text-green-700">Est. {money(r.priceEstimate)}</span>}
                {r.timelineDays != null && <span className="badge bg-slate-100 text-slate-600">{r.timelineDays} days</span>}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
