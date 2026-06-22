import { z } from "zod";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { created, fail, handleError } from "@/lib/api";

const schema = z.object({
  productId: z.string(),
  rating: z.number().int().min(1).max(5),
  printQuality: z.number().int().min(1).max(5).optional(),
  designQuality: z.number().int().min(1).max(5).optional(),
  title: z.string().optional(),
  body: z.string().optional(),
  authorName: z.string().optional(),
  photos: z.array(z.string()).optional()
});

// POST /api/reviews — leave a product review and update aggregates.
export async function POST(req: Request) {
  try {
    const input = schema.parse(await req.json());
    const product = await prisma.product.findUnique({ where: { id: input.productId } });
    if (!product) return fail("Product not found", 404);

    const user = await getCurrentUser();
    const review = await prisma.review.create({
      data: {
        productId: input.productId,
        userId: user?.id,
        authorName: input.authorName || user?.name || "Anonymous",
        rating: input.rating,
        printQuality: input.printQuality,
        designQuality: input.designQuality,
        title: input.title,
        body: input.body,
        photos: input.photos ?? [],
        verified: Boolean(user)
      }
    });

    // Recompute denormalised rating aggregates.
    const agg = await prisma.review.aggregate({
      where: { productId: input.productId },
      _avg: { rating: true },
      _count: true
    });
    await prisma.product.update({
      where: { id: input.productId },
      data: {
        ratingAvg: Math.round((agg._avg.rating ?? 0) * 10) / 10,
        ratingCount: agg._count
      }
    });

    return created(review);
  } catch (err) {
    return handleError(err);
  }
}
