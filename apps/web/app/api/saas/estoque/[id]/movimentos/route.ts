import { requireSaasRole } from "@/server/authz/gates";
import { listMovimentos } from "@/server/inventory/service";
import { handleError, ok } from "@/server/http/respond";

export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireSaasRole("admin", "vendedor");
    const { id } = await ctx.params;
    return ok(await listMovimentos(session, id, new URL(req.url)));
  } catch (err) {
    return handleError(err);
  }
}
