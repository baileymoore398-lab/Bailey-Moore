import { prisma } from "@/lib/db";
import { ok, handleError } from "@/lib/api";

// GET /api/products?category=&q=&featured=
export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const category = url.searchParams.get("category");
    const q = url.searchParams.get("q");
    const featured = url.searchParams.get("featured");

    const products = await prisma.product.findMany({
      where: {
        active: true,
        ...(featured === "true" ? { featured: true } : {}),
        ...(category ? { category: { slug: category } } : {}),
        ...(q
          ? { OR: [{ name: { contains: q, mode: "insensitive" } }, { description: { contains: q, mode: "insensitive" } }] }
          : {})
      },
      include: { category: true, defaultMaterial: true },
      orderBy: [{ featured: "desc" }, { ratingAvg: "desc" }]
    });
    return ok(products);
  } catch (err) {
    return handleError(err);
  }
}
