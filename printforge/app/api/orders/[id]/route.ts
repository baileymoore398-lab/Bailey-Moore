import { z } from "zod";
import { prisma } from "@/lib/db";
import { getCurrentUser, requireAdmin } from "@/lib/auth";
import { createShippingLabel, type Carrier } from "@/lib/integrations";
import { ok, fail, handleError } from "@/lib/api";

// GET /api/orders/:id — order detail + live status timeline.
// Lookup by id OR orderNumber so customers can track via their PF-… number.
export async function GET(_req: Request, { params }: { params: { id: string } }) {
  try {
    const order = await prisma.order.findFirst({
      where: { OR: [{ id: params.id }, { orderNumber: params.id }] },
      include: {
        items: true,
        history: { orderBy: { createdAt: "asc" } },
        shippingAddress: true,
        printJobs: { include: { printer: true } }
      }
    });
    if (!order) return fail("Order not found", 404);

    // Customers may only see their own orders; admins see all.
    const user = await getCurrentUser();
    const isOwner = user && order.userId === user.id;
    const isStaff = user && (user.role === "ADMIN" || user.role === "OPERATOR");
    if (order.userId && !isOwner && !isStaff) return fail("Not found", 404);

    return ok(order);
  } catch (err) {
    return handleError(err);
  }
}

const patchSchema = z.object({
  status: z
    .enum([
      "SUBMITTED", "REVIEWING", "DESIGNING", "APPROVED", "PRINTING",
      "QUALITY_CHECK", "PACKED", "SHIPPED", "DELIVERED", "CANCELLED"
    ])
    .optional(),
  note: z.string().optional(),
  carrier: z.enum(["NZ_POST", "ARAMEX_NZ", "COURIER_POST"]).optional(),
  paymentStatus: z.enum(["PENDING", "PAID", "REFUNDED", "FAILED"]).optional()
});

// PATCH /api/orders/:id — admin/operator advances the production workflow.
export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  try {
    await requireAdmin();
    const body = patchSchema.parse(await req.json());
    const order = await prisma.order.findUnique({ where: { id: params.id } });
    if (!order) return fail("Order not found", 404);

    const data: Record<string, unknown> = {};
    if (body.paymentStatus) data.paymentStatus = body.paymentStatus;

    // When moving to SHIPPED, generate a tracking label.
    if (body.status === "SHIPPED" && body.carrier) {
      const label = await createShippingLabel(body.carrier as Carrier, { id: order.id });
      data.carrier = label.carrier;
      data.trackingNumber = label.trackingNumber;
      data.trackingUrl = label.trackingUrl;
    }
    if (body.status) data.status = body.status;

    const updated = await prisma.order.update({
      where: { id: order.id },
      data: {
        ...data,
        ...(body.status
          ? { history: { create: { status: body.status, note: body.note } } }
          : {})
      },
      include: { history: { orderBy: { createdAt: "asc" } }, items: true }
    });
    return ok(updated);
  } catch (err) {
    return handleError(err);
  }
}
