import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import { ok, handleError } from "@/lib/api";

// GET /api/admin/metrics — dashboard analytics.
export async function GET() {
  try {
    await requireAdmin();

    const now = new Date();
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    const [
      ordersToday,
      ordersMonth,
      revenueMonthAgg,
      revenueAllAgg,
      openOrders,
      customers,
      printers,
      topProductsRaw,
      pendingRequests
    ] = await Promise.all([
      prisma.order.count({ where: { createdAt: { gte: startOfDay } } }),
      prisma.order.count({ where: { createdAt: { gte: startOfMonth } } }),
      prisma.order.aggregate({ _sum: { total: true }, where: { paymentStatus: "PAID", createdAt: { gte: startOfMonth } } }),
      prisma.order.aggregate({ _sum: { total: true }, where: { paymentStatus: "PAID" } }),
      prisma.order.count({ where: { status: { notIn: ["DELIVERED", "CANCELLED"] } } }),
      prisma.user.count({ where: { role: "CUSTOMER" } }),
      prisma.printer.findMany(),
      prisma.orderItem.groupBy({
        by: ["productId"],
        _sum: { quantity: true, lineTotal: true },
        where: { productId: { not: null } },
        orderBy: { _sum: { lineTotal: "desc" } },
        take: 5
      }),
      prisma.customRequest.count({ where: { status: { in: ["NEW", "IN_REVIEW"] } } })
    ]);

    // resolve top product names
    const topProducts = await Promise.all(
      topProductsRaw.map(async (row) => {
        const p = row.productId
          ? await prisma.product.findUnique({ where: { id: row.productId }, select: { name: true, slug: true } })
          : null;
        return {
          name: p?.name ?? "Unknown",
          slug: p?.slug,
          unitsSold: row._sum.quantity ?? 0,
          revenue: row._sum.lineTotal ?? 0
        };
      })
    );

    const printerUtilisation =
      printers.length === 0
        ? 0
        : Math.round(
            (printers.filter((p) => p.status === "PRINTING").length / printers.length) * 100
          );

    const filamentRemaining = printers.reduce((s, p) => s + p.filamentRemainingG, 0);

    return ok({
      revenue: {
        month: revenueMonthAgg._sum.total ?? 0,
        allTime: revenueAllAgg._sum.total ?? 0
      },
      orders: { today: ordersToday, month: ordersMonth, open: openOrders },
      customers,
      pendingRequests,
      topProducts,
      printers: {
        total: printers.length,
        utilisation: printerUtilisation,
        filamentRemainingG: filamentRemaining,
        fleet: printers.map((p) => ({ name: p.name, status: p.status, successRate: p.successRate, filamentRemainingG: p.filamentRemainingG }))
      }
    });
  } catch (err) {
    return handleError(err);
  }
}
