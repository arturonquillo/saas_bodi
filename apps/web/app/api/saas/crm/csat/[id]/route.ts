import { requireSaasRole } from "@/server/authz/gates";
import { z } from "zod";
import { getCsat, patchCsat } from "@/server/crm/csat";
import { ApiError, handleError, ok } from "@/server/http/respond";

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireSaasRole("admin");
    const { id } = await ctx.params;
    return ok(await getCsat(session, id));
  } catch (err) {
    return handleError(err);
  }
}

const patchSchema = z.object({ review_note: z.string() });

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireSaasRole("admin");
    const { id } = await ctx.params;
    const parsed = patchSchema.safeParse(await req.json());
    if (!parsed.success) throw new ApiError("validacao", "Dados inválidos.");
    return ok(await patchCsat(session, id, parsed.data));
  } catch (err) {
    return handleError(err);
  }
}
