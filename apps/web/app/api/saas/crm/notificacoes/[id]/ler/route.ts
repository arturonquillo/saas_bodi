import { requireSaasRole } from "@/server/authz/gates";
import { markNotificacaoLida } from "@/server/crm/meta";
import { handleError, ok } from "@/server/http/respond";

export async function POST(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireSaasRole("admin", "vendedor");
    const { id } = await ctx.params;
    return ok(await markNotificacaoLida(session, id));
  } catch (err) {
    return handleError(err);
  }
}

