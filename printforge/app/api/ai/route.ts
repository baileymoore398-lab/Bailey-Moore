import { z } from "zod";
import { getDesignSuggestion } from "@/lib/ai";
import { ok, handleError } from "@/lib/api";

const schema = z.object({ brief: z.string().min(3) });

// POST /api/ai — AI design assistant (material + settings suggestions).
export async function POST(req: Request) {
  try {
    const { brief } = schema.parse(await req.json());
    const suggestion = await getDesignSuggestion(brief);
    return ok(suggestion);
  } catch (err) {
    return handleError(err);
  }
}
