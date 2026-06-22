import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { money } from "@/lib/utils";
import { ReviewForm } from "@/components/review-form";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: { slug: string } }) {
  const product = await prisma.product.findUnique({ where: { slug: params.slug } });
  if (!product) return { title: "Product not found" };
  return {
    title: product.metaTitle || product.name,
    description: product.metaDescription || product.description || undefined
  };
}

export default async function ProductDetail({ params }: { params: { slug: string } }) {
  const product = await prisma.product.findUnique({
    where: { slug: params.slug },
    include: { category: true, defaultMaterial: true, reviews: { orderBy: { createdAt: "desc" }, take: 20 } }
  });
  if (!product) notFound();

  const related = await prisma.product.findMany({
    where: { active: true, categoryId: product.categoryId, NOT: { id: product.id } },
    take: 4
  });

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: product.name,
    description: product.description,
    offers: { "@type": "Offer", price: product.priceNzd, priceCurrency: "NZD" },
    aggregateRating:
      product.ratingCount > 0
        ? { "@type": "AggregateRating", ratingValue: product.ratingAvg, reviewCount: product.ratingCount }
        : undefined
  };

  return (
    <div className="mx-auto max-w-6xl px-4 py-12">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />

      <nav className="text-sm text-slate-500">
        <Link href="/products" className="hover:underline">Store</Link>
        {product.category && <> / <Link href={`/products?category=${product.category.slug}`} className="hover:underline">{product.category.name}</Link></>}
      </nav>

      <div className="mt-6 grid gap-10 lg:grid-cols-2">
        <div className="grid h-80 place-items-center rounded-xl bg-slate-100 text-7xl">🧩</div>

        <div>
          <h1 className="text-3xl font-bold">{product.name}</h1>
          <div className="mt-2 flex items-center gap-3 text-sm">
            <span className="text-amber-500">★ {product.ratingAvg.toFixed(1)}</span>
            <span className="text-slate-400">({product.ratingCount} reviews)</span>
            {product.defaultMaterial && <span className="badge bg-brand-50 text-brand-700">{product.defaultMaterial.name}</span>}
          </div>
          <p className="mt-4 text-slate-600">{product.description}</p>

          <div className="mt-6 text-3xl font-bold text-brand-700">
            {product.type === "SERVICE" ? "Request a quote" : money(product.priceNzd)}
          </div>

          <div className="mt-6 flex gap-3">
            {product.type === "SERVICE" ? (
              <Link href="/custom-request" className="btn-accent">Request a design</Link>
            ) : product.type === "DIGITAL_STL" ? (
              <button className="btn-primary">Buy & download STL</button>
            ) : (
              <button className="btn-primary">Add to cart</button>
            )}
            <Link href="/quote" className="btn-ghost">Print your own file</Link>
          </div>
        </div>
      </div>

      {/* Reviews */}
      <section className="mt-14 grid gap-8 lg:grid-cols-2">
        <div>
          <h2 className="text-xl font-bold">Reviews</h2>
          <div className="mt-4 space-y-4">
            {product.reviews.length === 0 && <p className="text-sm text-slate-500">No reviews yet — be the first!</p>}
            {product.reviews.map((r) => (
              <div key={r.id} className="card p-4">
                <div className="flex items-center justify-between">
                  <span className="font-medium">{r.authorName}</span>
                  <span className="text-amber-500">{"★".repeat(r.rating)}</span>
                </div>
                {r.title && <p className="mt-1 font-medium">{r.title}</p>}
                {r.body && <p className="mt-1 text-sm text-slate-600">{r.body}</p>}
                <div className="mt-2 flex gap-3 text-xs text-slate-400">
                  {r.printQuality && <span>Print {r.printQuality}/5</span>}
                  {r.designQuality && <span>Design {r.designQuality}/5</span>}
                  {r.verified && <span className="text-green-600">Verified buyer</span>}
                </div>
              </div>
            ))}
          </div>
        </div>
        <ReviewForm productId={product.id} />
      </section>

      {/* Related */}
      {related.length > 0 && (
        <section className="mt-14">
          <h2 className="text-xl font-bold">Related products</h2>
          <div className="mt-4 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {related.map((p) => (
              <Link key={p.id} href={`/products/${p.slug}`} className="card p-5 transition hover:border-brand-400 hover:shadow-md">
                <div className="grid h-24 place-items-center rounded-lg bg-slate-100 text-3xl">🧩</div>
                <h3 className="mt-2 font-semibold">{p.name}</h3>
                <span className="text-sm font-bold text-brand-700">{money(p.priceNzd)}</span>
              </Link>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
