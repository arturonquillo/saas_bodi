import { requireSaasRole } from "@/server/authz/gates";
import { deletePushSubscription } from "@/server/crm/push";
import { handleError, ok } from "@/server/http/respond";

export async function DELETE(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireSaasRole("admin", "vendedor");
    const { id } = await ctx.params;
    return ok(await deletePushSubscription(session, id));
  } catch (err) {
    return handleError(err);
  }
}
