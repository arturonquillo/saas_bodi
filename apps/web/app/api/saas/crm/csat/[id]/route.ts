import { requireSaasRole } from "@/server/authz/gates";
import { getCsat } from "@/server/crm/csat";
import { handleError, ok } from "@/server/http/respond";

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireSaasRole("admin");
    const { id } = await ctx.params;
    return ok(await getCsat(session, id));
  } catch (err) {
    return handleError(err);
  }
}
