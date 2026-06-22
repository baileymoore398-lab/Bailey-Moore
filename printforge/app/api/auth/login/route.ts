import { z } from "zod";
import { prisma } from "@/lib/db";
import { verifyPassword, setSessionCookie } from "@/lib/auth";
import { ok, fail, handleError } from "@/lib/api";

const schema = z.object({
  email: z.string().email(),
  password: z.string().min(1)
});

export async function POST(req: Request) {
  try {
    const { email, password } = schema.parse(await req.json());
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user || !user.passwordHash || !(await verifyPassword(password, user.passwordHash))) {
      return fail("Invalid email or password", 401);
    }
    await setSessionCookie(user.id);
    return ok({ id: user.id, email: user.email, name: user.name, role: user.role });
  } catch (err) {
    return handleError(err);
  }
}
