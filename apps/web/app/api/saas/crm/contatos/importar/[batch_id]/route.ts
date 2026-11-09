import { requireSaasRole } from "@/server/authz/gates";
import { getImportBatch } from "@/server/crm/merge-import";
import { handleError, ok } from "@/server/http/respond";

export async function GET(_req: Request, ctx: { params: Promise<{ batch_id: string }> }) {
  try {
    const session = await requireSaasRole("admin", "vendedor");
    const { batch_id } = await ctx.params;
    return ok(await getImportBatch(session, batch_id));
  } catch (err) {
    return handleError(err);
  }
}
