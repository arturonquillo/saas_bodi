import { requireSaasRole } from "@/server/authz/gates";
import { clonarAutomacao } from "@/server/crm/automations";
import { handleError, ok } from "@/server/http/respond";

export async function POST(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireSaasRole("admin");
    const { id } = await ctx.params;
    return ok(await clonarAutomacao(session, id), 201);
  } catch (err) {
    return handleError(err);
  }
}
