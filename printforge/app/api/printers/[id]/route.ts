import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import { ok, handleError } from "@/lib/api";

const schema = z.object({
  status: z.enum(["IDLE", "PRINTING", "MAINTENANCE", "OFFLINE"]).optional(),
  filamentRemainingG: z.number().int().optional(),
  loadedMaterialId: z.string().nullable().optional(),
  nextMaintenance: z.string().optional()
});

// PATCH /api/printers/:id — update status / filament / maintenance.
export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  try {
    await requireAdmin();
    const body = schema.parse(await req.json());
    const printer = await prisma.printer.update({
      where: { id: params.id },
      data: {
        ...body,
        nextMaintenance: body.nextMaintenance ? new Date(body.nextMaintenance) : undefined
      }
    });
    return ok(printer);
  } catch (err) {
    return handleError(err);
  }
}
