import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import { ok, created, handleError } from "@/lib/api";

// GET /api/printers — fleet status (admin/operator).
export async function GET() {
  try {
    await requireAdmin();
    const printers = await prisma.printer.findMany({
      orderBy: { name: "asc" },
      include: { printJobs: { where: { status: { in: ["QUEUED", "RUNNING"] } } } }
    });
    return ok(printers);
  } catch (err) {
    return handleError(err);
  }
}

const schema = z.object({
  name: z.string(),
  brand: z.enum(["BAMBU_LAB", "PRUSA", "CREALITY", "VORON"]),
  model: z.string().optional(),
  buildX: z.number().int().optional(),
  buildY: z.number().int().optional(),
  buildZ: z.number().int().optional()
});

// POST /api/printers — register a printer (admin).
export async function POST(req: Request) {
  try {
    await requireAdmin();
    const body = schema.parse(await req.json());
    const printer = await prisma.printer.create({ data: body });
    return created(printer);
  } catch (err) {
    return handleError(err);
  }
}
