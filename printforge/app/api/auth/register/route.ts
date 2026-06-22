import { z } from "zod";
import { prisma } from "@/lib/db";
import { hashPassword, setSessionCookie } from "@/lib/auth";
import { created, fail, handleError } from "@/lib/api";

const schema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  name: z.string().min(1).optional(),
  accountType: z.enum(["INDIVIDUAL", "BUSINESS"]).optional(),
  businessName: z.string().optional()
});

export async function POST(req: Request) {
  try {
    const body = schema.parse(await req.json());
    const existing = await prisma.user.findUnique({ where: { email: body.email } });
    if (existing) return fail("An account with that email already exists", 409);

    const user = await prisma.user.create({
      data: {
        email: body.email,
        name: body.name,
        passwordHash: await hashPassword(body.password),
        accountType: body.accountType ?? "INDIVIDUAL",
        businessName: body.businessName,
        referralCode: Math.random().toString(36).slice(2, 8).toUpperCase()
      },
      select: { id: true, email: true, name: true, role: true }
    });
    await setSessionCookie(user.id);
    return created(user);
  } catch (err) {
    return handleError(err);
  }
}
