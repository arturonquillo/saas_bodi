import { requireSaasRole } from "@/server/authz/gates";
import { testarWebhook } from "@/server/crm/webhooks";
import { handleError, ok } from "@/server/http/respond";

export async function POST(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireSaasRole("admin");
    const { id } = await ctx.params;
    return ok(await testarWebhook(session, id));
  } catch (err) {
    return handleError(err);
  }
}
