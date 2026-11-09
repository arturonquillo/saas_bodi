import { requireSaasRole } from "@/server/authz/gates";
import { disconnectIntegracao } from "@/server/crm/integrations";
import { handleError, ok } from "@/server/http/respond";

export async function POST(_req: Request, ctx: { params: Promise<{ provider: string }> }) {
  try {
    const session = await requireSaasRole("admin");
    const { provider } = await ctx.params;
    return ok(await disconnectIntegracao(session, provider));
  } catch (err) {
    return handleError(err);
  }
}
