import { clearSessionCookie } from "@/lib/auth";
import { ok } from "@/lib/api";

export async function POST() {
  clearSessionCookie();
  return ok({ loggedOut: true });
}
