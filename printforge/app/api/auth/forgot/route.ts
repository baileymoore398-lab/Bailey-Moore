import { z } from "zod";
import { randomUUID } from "crypto";
import { prisma } from "@/lib/db";
import { sendEmail } from "@/lib/integrations";
import { ok, handleError } from "@/lib/api";

const schema = z.object({ email: z.string().email() });

// POST /api/auth/forgot — issue a password reset token.
// Always responds 200 to avoid leaking which emails are registered.
export async function POST(req: Request) {
  try {
    const { email } = schema.parse(await req.json());
    const user = await prisma.user.findUnique({ where: { email } });
    if (user) {
      const token = randomUUID();
      await prisma.passwordReset.create({
        data: { userId: user.id, token, expiresAt: new Date(Date.now() + 1000 * 60 * 60) }
      });
      const url = `${process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000"}/reset-password?token=${token}`;
      await sendEmail(email, "Reset your PrintForge NZ password", `Reset link: ${url}`);
    }
    return ok({ sent: true });
  } catch (err) {
    return handleError(err);
  }
}
