import { prisma } from "@/lib/db";
import { analyzeModel } from "@/lib/geometry";
import { computeQuote } from "@/lib/quote";
import { getCurrentUser } from "@/lib/auth";
import { ok, fail, handleError } from "@/lib/api";

export const runtime = "nodejs";
export const maxDuration = 60;

const MAX_BYTES = 60 * 1024 * 1024; // 60 MB

// POST /api/quote
// Accepts multipart/form-data: file=<model>, materialCode, infill, layerHeight,
// quantity. Returns geometry analysis + full cost breakdown, and persists the
// project/file/quote so it can be converted to an order.
export async function POST(req: Request) {
  try {
    const form = await req.formData();
    const file = form.get("file");
    const materialCode = String(form.get("materialCode") || "PLA");
    const infillPct = Number(form.get("infill") ?? 20);
    const layerHeightMm = Number(form.get("layerHeight") ?? 0.2);
    const quantity = Number(form.get("quantity") ?? 1);

    if (!(file instanceof File)) return fail("A model file is required", 422);
    if (file.size > MAX_BYTES) return fail("File exceeds 60MB limit", 413);

    const material = await prisma.material.findUnique({ where: { code: materialCode } });
    if (!material) return fail(`Unknown material: ${materialCode}`, 422);

    const buf = Buffer.from(await file.arrayBuffer());
    const analysis = analyzeModel(file.name, buf);
    if (analysis.volumeCm3 <= 0) {
      return fail("Could not determine model volume — the mesh may not be watertight.", 422);
    }

    const quote = computeQuote({
      volumeCm3: analysis.volumeCm3,
      bbox: analysis.bbox,
      material: {
        code: material.code,
        name: material.name,
        densityGCm3: material.densityGCm3,
        pricePerKgNzd: material.pricePerKgNzd,
        speedFactor: material.speedFactor
      },
      settings: { infillPct, layerHeightMm, quantity }
    });

    // Persist (best-effort — quote still returned even if DB write is skipped)
    const user = await getCurrentUser();
    let quoteId: string | undefined;
    try {
      const project = await prisma.project.create({
        data: {
          name: file.name,
          userId: user?.id,
          files: {
            create: {
              kind: "MODEL",
              filename: file.name,
              storageKey: `local/${Date.now()}-${file.name}`,
              mimeType: file.type || "application/octet-stream",
              sizeBytes: file.size,
              volumeCm3: analysis.volumeCm3,
              bboxX: analysis.bbox.x,
              bboxY: analysis.bbox.y,
              bboxZ: analysis.bbox.z,
              triangles: analysis.triangles
            }
          }
        },
        include: { files: true }
      });
      const saved = await prisma.quote.create({
        data: {
          projectId: project.id,
          fileId: project.files[0]?.id,
          materialId: material.id,
          infillPct,
          layerHeightMm,
          quantity,
          volumeCm3: quote.volumeCm3,
          weightGrams: quote.weightGrams,
          printMinutes: quote.printMinutes,
          supportRequired: quote.supportRequired,
          materialCost: quote.materialCost,
          machineCost: quote.machineCost,
          labourCost: quote.labourCost,
          shippingEstimate: quote.shippingEstimate,
          subtotal: quote.subtotal,
          gst: quote.gst,
          total: quote.total,
          status: "DRAFT",
          expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 24 * 14)
        }
      });
      quoteId = saved.id;
    } catch (e) {
      console.error("quote persist failed", e);
    }

    return ok({
      quoteId,
      analysis,
      material: { code: material.code, name: material.name },
      settings: { infillPct, layerHeightMm, quantity },
      quote
    });
  } catch (err) {
    return handleError(err);
  }
}
