import { requirePermission } from "@/server/authz/gates";
import { getAudit } from "@/server/crm/audit";
import { handleError, ok } from "@/server/http/respond";

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const session = await requirePermission("audit_read");
    const { id } = await ctx.params;
    return ok(await getAudit(session, id));
  } catch (err) {
    return handleError(err);
  }
}
