import { requireSaasRole } from "@/server/authz/gates";
import { getWidgetSnippet } from "@/server/crm/inboxes";
import { handleError, ok } from "@/server/http/respond";

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireSaasRole("admin");
    const { id } = await ctx.params;
    return ok(await getWidgetSnippet(session, id));
  } catch (err) {
    return handleError(err);
  }
}
