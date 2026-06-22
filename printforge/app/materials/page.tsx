import { prisma } from "@/lib/db";
import { money } from "@/lib/utils";

export const metadata = { title: "Materials" };
export const dynamic = "force-dynamic";

function strengthBar(rating: number) {
  return "●".repeat(rating) + "○".repeat(5 - rating);
}

export default async function MaterialsPage() {
  const materials = await prisma.material.findMany({
    where: { active: true },
    orderBy: { strengthRating: "asc" }
  });

  return (
    <div className="mx-auto max-w-7xl px-4 py-12">
      <h1 className="text-3xl font-bold">Materials</h1>
      <p className="mt-2 max-w-2xl text-slate-600">
        We print in seven production-grade filaments. Not sure which to pick? Our{" "}
        <a href="/ai-assistant" className="text-brand-700 underline">AI assistant</a> will recommend one for your use case.
      </p>

      <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {materials.map((m) => (
          <div key={m.id} className="card p-6">
            <div className="flex items-start justify-between">
              <h2 className="text-lg font-semibold">{m.name}</h2>
              <span className="badge bg-brand-50 text-brand-700">{m.code}</span>
            </div>
            <p className="mt-2 text-sm text-slate-600">{m.description}</p>
            <dl className="mt-4 space-y-1 text-sm">
              <div className="flex justify-between">
                <dt className="text-slate-500">Strength</dt>
                <dd className="font-mono text-brand-600">{strengthBar(m.strengthRating)}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-slate-500">Density</dt>
                <dd className="font-medium">{m.densityGCm3} g/cm³</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-slate-500">From</dt>
                <dd className="font-medium">{money(m.pricePerKgNzd)}/kg</dd>
              </div>
            </dl>
            {m.colours.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-1">
                {m.colours.map((c) => (
                  <span key={c} className="badge bg-slate-100 text-slate-600">{c}</span>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
