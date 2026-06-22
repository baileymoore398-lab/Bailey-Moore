import { prisma } from "@/lib/db";
import { ok, fail, handleError } from "@/lib/api";

export async function GET(_req: Request, { params }: { params: { slug: string } }) {
  try {
    const product = await prisma.product.findUnique({
      where: { slug: params.slug },
      include: {
        category: true,
        defaultMaterial: true,
        reviews: { orderBy: { createdAt: "desc" }, take: 20 }
      }
    });
    if (!product) return fail("Product not found", 404);

    const related = await prisma.product.findMany({
      where: { active: true, categoryId: product.categoryId, NOT: { id: product.id } },
      take: 4
    });
    return ok({ product, related });
  } catch (err) {
    return handleError(err);
  }
}
