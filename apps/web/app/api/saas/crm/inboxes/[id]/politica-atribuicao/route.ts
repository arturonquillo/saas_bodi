import { z } from "zod";
import { requireSaasRole } from "@/server/authz/gates";
import { getPoliticaAtribuicao, putPoliticaAtribuicao } from "@/server/crm/assignment";
import { ApiError, handleError, ok } from "@/server/http/respond";

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireSaasRole("admin", "vendedor");
    const { id } = await ctx.params;
    return ok(await getPoliticaAtribuicao(session, id));
  } catch (err) {
    return handleError(err);
  }
}

const putSchema = z.object({
  kind: z.literal("round_robin").optional(),
  enabled: z.boolean(),
});

export async function PUT(req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireSaasRole("admin");
    const { id } = await ctx.params;
    const parsed = putSchema.safeParse(await req.json());
    if (!parsed.success) throw new ApiError("validacao", "Dados inválidos.");
    return ok(await putPoliticaAtribuicao(session, id, parsed.data));
  } catch (err) {
    return handleError(err);
  }
}
