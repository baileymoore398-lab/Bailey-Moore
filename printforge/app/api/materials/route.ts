import { prisma } from "@/lib/db";
import { ok, handleError } from "@/lib/api";

export async function GET() {
  try {
    const materials = await prisma.material.findMany({
      where: { active: true },
      orderBy: { strengthRating: "asc" }
    });
    return ok(materials);
  } catch (err) {
    return handleError(err);
  }
}
