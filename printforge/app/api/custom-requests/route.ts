import { z } from "zod";
import { prisma } from "@/lib/db";
import { getCurrentUser, requireAdmin } from "@/lib/auth";
import { sendEmail } from "@/lib/integrations";
import { ok, created, handleError } from "@/lib/api";

const schema = z.object({
  title: z.string().min(3),
  description: z.string().min(10),
  category: z.string().optional(),
  contactEmail: z.string().email().optional(),
  attachments: z.array(z.string()).optional()
});

// POST: submit a custom design request (e.g. "custom GoPro mount for my bike")
export async function POST(req: Request) {
  try {
    const body = schema.parse(await req.json());
    const user = await getCurrentUser();
    const request = await prisma.customRequest.create({
      data: {
        userId: user?.id,
        title: body.title,
        description: body.description,
        category: body.category,
        contactEmail: body.contactEmail ?? user?.email,
        attachments: body.attachments ?? []
      }
    });
    // Notify admin (logged in dev / emailed in prod)
    await sendEmail(
      process.env.ADMIN_EMAIL || "admin@printforge.nz",
      `New custom request: ${body.title}`,
      body.description
    );
    return created(request);
  } catch (err) {
    return handleError(err);
  }
}

// GET (admin): list all custom requests
export async function GET() {
  try {
    await requireAdmin();
    const requests = await prisma.customRequest.findMany({
      orderBy: { createdAt: "desc" },
      include: { user: { select: { email: true, name: true } } }
    });
    return ok(requests);
  } catch (err) {
    return handleError(err);
  }
}
