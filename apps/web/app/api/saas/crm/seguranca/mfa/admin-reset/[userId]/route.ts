import { requireSaasRole } from "@/server/authz/gates";
import { adminResetMfa } from "@/server/crm/security";
import { handleError, ok } from "@/server/http/respond";

export async function POST(_req: Request, ctx: { params: Promise<{ userId: string }> }) {
  try {
    const session = await requireSaasRole("admin");
    const { userId } = await ctx.params;
    return ok(await adminResetMfa(session, userId));
  } catch (err) {
    return handleError(err);
  }
}
