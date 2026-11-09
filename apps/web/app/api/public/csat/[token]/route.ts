import { z } from "zod";
import { getPublicCsat, submitPublicCsat } from "@/server/crm/csat";
import { ApiError, handleError, ok } from "@/server/http/respond";

export async function GET(_req: Request, ctx: { params: Promise<{ token: string }> }) {
  try {
    const { token } = await ctx.params;
    return ok(await getPublicCsat(token));
  } catch (err) {
    return handleError(err);
  }
}

const postSchema = z.object({
  rating: z.number().int().min(1).max(5),
  feedback_message: z.string().nullable().optional(),
});

export async function POST(req: Request, ctx: { params: Promise<{ token: string }> }) {
  try {
    const { token } = await ctx.params;
    const parsed = postSchema.safeParse(await req.json());
    if (!parsed.success) throw new ApiError("validacao", "Dados inválidos.");
    return ok(await submitPublicCsat(token, parsed.data), 201);
  } catch (err) {
    return handleError(err);
  }
}
