import { requireSaasRole } from "@/server/authz/gates";
import { listDestinatarios } from "@/server/crm/campaigns";
import { handleError, ok } from "@/server/http/respond";

export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireSaasRole("admin");
    const { id } = await ctx.params;
    return ok(await listDestinatarios(session, id, new URL(req.url)));
  } catch (err) {
    return handleError(err);
  }
}
