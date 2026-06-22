import { z } from "zod";
import { prisma } from "@/lib/db";
import { createPaymentIntent } from "@/lib/integrations";
import { ok, fail, handleError } from "@/lib/api";

const schema = z.object({ orderId: z.string() });

// POST /api/checkout — create a Stripe PaymentIntent for an order.
// Supports Apple Pay / Google Pay / cards via Stripe automatic payment methods.
export async function POST(req: Request) {
  try {
    const { orderId } = schema.parse(await req.json());
    const order = await prisma.order.findUnique({ where: { id: orderId } });
    if (!order) return fail("Order not found", 404);
    if (order.paymentStatus === "PAID") return fail("Order already paid", 409);

    const intent = await createPaymentIntent(order.total, { orderId: order.id, orderNumber: order.orderNumber });
    await prisma.order.update({
      where: { id: order.id },
      data: { stripePaymentIntentId: intent.id }
    });

    return ok({
      clientSecret: intent.clientSecret,
      amount: intent.amount,
      currency: "nzd",
      mock: intent.mock,
      publishableKey: process.env.STRIPE_PUBLISHABLE_KEY ?? null
    });
  } catch (err) {
    return handleError(err);
  }
}
