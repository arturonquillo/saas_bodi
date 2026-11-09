import { requireSaasRole } from "@/server/authz/gates";
import { listAppsPainelForConversation } from "@/server/crm/dashboard-apps";
import { handleError, ok } from "@/server/http/respond";

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireSaasRole("admin", "vendedor");
    const { id } = await ctx.params;
    return ok(await listAppsPainelForConversation(session, id));
  } catch (err) {
    return handleError(err);
  }
}
