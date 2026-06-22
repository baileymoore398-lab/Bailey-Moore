import Link from "next/link";
import { prisma } from "@/lib/db";
import { money } from "@/lib/utils";

export const metadata = { title: "Store" };
export const dynamic = "force-dynamic";

export default async function ProductsPage({
  searchParams
}: {
  searchParams: { category?: string; q?: string };
}) {
  const { category, q } = searchParams;
  const [products, categories] = await Promise.all([
    prisma.product.findMany({
      where: {
        active: true,
        ...(category ? { category: { slug: category } } : {}),
        ...(q ? { OR: [{ name: { contains: q, mode: "insensitive" } }, { description: { contains: q, mode: "insensitive" } }] } : {})
      },
      include: { category: true, defaultMaterial: true },
      orderBy: [{ featured: "desc" }, { ratingAvg: "desc" }]
    }),
    prisma.category.findMany({ orderBy: { name: "asc" } })
  ]);

  return (
    <div className="mx-auto max-w-7xl px-4 py-12">
      <h1 className="text-3xl font-bold">Store</h1>

      {/* Filters */}
      <form className="mt-6 flex flex-wrap items-center gap-3" action="/products">
        <input name="q" defaultValue={q} placeholder="Search products…" className="input max-w-xs" />
        <button className="btn-primary" type="submit">Search</button>
      </form>

      <div className="mt-4 flex flex-wrap gap-2">
        <Link href="/products" className={`badge ${!category ? "bg-brand-600 text-white" : "bg-slate-100 text-slate-600"}`}>
          All
        </Link>
        {categories.map((c) => (
          <Link
            key={c.slug}
            href={`/products?category=${c.slug}`}
            className={`badge ${category === c.slug ? "bg-brand-600 text-white" : "bg-slate-100 text-slate-600"}`}
          >
            {c.name}
          </Link>
        ))}
      </div>

      {products.length === 0 ? (
        <p className="mt-10 text-slate-500">No products found.</p>
      ) : (
        <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {products.map((p) => (
            <Link key={p.id} href={`/products/${p.slug}`} className="card flex flex-col p-5 transition hover:border-brand-400 hover:shadow-md">
              <div className="grid h-32 place-items-center rounded-lg bg-slate-100 text-4xl">🧩</div>
              <div className="mt-3 flex-1">
                <div className="flex items-center gap-2">
                  {p.featured && <span className="badge bg-forge-500 text-white">Featured</span>}
                  {p.type !== "PHYSICAL" && <span className="badge bg-slate-100 text-slate-600">{p.type === "DIGITAL_STL" ? "STL" : "Service"}</span>}
                </div>
                <h3 className="mt-2 font-semibold">{p.name}</h3>
                <p className="mt-1 line-clamp-2 text-xs text-slate-500">{p.description}</p>
              </div>
              <div className="mt-3 flex items-center justify-between">
                <span className="font-bold text-brand-700">{p.type === "SERVICE" ? "Quote" : money(p.priceNzd)}</span>
                <span className="text-xs text-amber-500">★ {p.ratingAvg.toFixed(1)} ({p.ratingCount})</span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
