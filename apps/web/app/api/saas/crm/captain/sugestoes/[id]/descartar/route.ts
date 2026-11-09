import { requireSaasRole } from "@/server/authz/gates";
import { descartarSugestao } from "@/server/crm/captain";
import { handleError, ok } from "@/server/http/respond";

export async function POST(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireSaasRole("admin", "vendedor");
    const { id } = await ctx.params;
    return ok(await descartarSugestao(session, id));
  } catch (err) {
    return handleError(err);
  }
}
