import { z } from "zod";
import { prisma } from "@/lib/db";
import { getCurrentUser, requireUser } from "@/lib/auth";
import { genOrderNumber } from "@/lib/utils";
import { PRICING, estimateShipping } from "@/lib/quote";
import { ok, created, fail, handleError } from "@/lib/api";

const itemSchema = z.object({
  productId: z.string().optional(),
  description: z.string(),
  quantity: z.number().int().positive().default(1),
  unitPrice: z.number().nonnegative()
});

const schema = z.object({
  quoteId: z.string().optional(),
  items: z.array(itemSchema).optional(),
  shippingAddressId: z.string().optional(),
  discountCode: z.string().optional(),
  notes: z.string().optional()
});

// POST /api/orders — create an order from a saved quote or a list of items.
export async function POST(req: Request) {
  try {
    const body = schema.parse(await req.json());
    const user = await getCurrentUser();

    let subtotal = 0;
    let shipping = 0;
    const itemsData: { productId?: string; description: string; quantity: number; unitPrice: number; lineTotal: number }[] = [];

    if (body.quoteId) {
      const quote = await prisma.quote.findUnique({ where: { id: body.quoteId }, include: { material: true } });
      if (!quote) return fail("Quote not found", 404);
      subtotal = quote.subtotal;
      shipping = quote.shippingEstimate;
      itemsData.push({
        description: `Custom 3D print — ${quote.material.name} (${quote.quantity}x)`,
        quantity: quote.quantity,
        unitPrice: round2(quote.subtotal / Math.max(1, quote.quantity)),
        lineTotal: quote.subtotal
      });
    }

    for (const it of body.items ?? []) {
      const line = it.unitPrice * it.quantity;
      subtotal += line;
      itemsData.push({ ...it, lineTotal: line });
    }

    if (itemsData.length === 0) return fail("Order has no items", 422);
    if (!body.quoteId) shipping = estimateShipping(0) + 6; // flat-ish for store items

    // Discount
    let discount = 0;
    let discountCodeId: string | undefined;
    if (body.discountCode) {
      const code = await prisma.discountCode.findUnique({ where: { code: body.discountCode.toUpperCase() } });
      if (code && code.active && (!code.expiresAt || code.expiresAt > new Date())) {
        discount = code.type === "PERCENT" ? (subtotal * code.value) / 100 : code.value;
        discountCodeId = code.id;
      }
    }

    const taxable = Math.max(0, subtotal - discount) + shipping;
    const gst = round2(taxable * PRICING.GST_RATE);
    const total = round2(taxable + gst);

    const order = await prisma.order.create({
      data: {
        orderNumber: genOrderNumber(),
        userId: user?.id,
        quoteId: body.quoteId,
        shippingAddressId: body.shippingAddressId,
        discountCodeId,
        subtotal: round2(subtotal),
        discount: round2(discount),
        shipping: round2(shipping),
        gst,
        total,
        notes: body.notes,
        items: { create: itemsData },
        history: { create: { status: "SUBMITTED", note: "Order received" } }
      },
      include: { items: true, history: true }
    });

    if (discountCodeId) {
      await prisma.discountCode.update({ where: { id: discountCodeId }, data: { uses: { increment: 1 } } });
    }

    return created(order);
  } catch (err) {
    return handleError(err);
  }
}

// GET /api/orders — current user's order history
export async function GET() {
  try {
    const user = await requireUser();
    const orders = await prisma.order.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" },
      include: { items: true }
    });
    return ok(orders);
  } catch (err) {
    return handleError(err);
  }
}

function round2(n: number) {
  return Math.round(n * 100) / 100;
}
