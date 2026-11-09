import { requireSaasRole } from "@/server/authz/gates";
import { publicarArtigo } from "@/server/crm/help-center";
import { handleError, ok } from "@/server/http/respond";

export async function POST(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireSaasRole("admin");
    const { id } = await ctx.params;
    return ok(await publicarArtigo(session, id));
  } catch (err) {
    return handleError(err);
  }
}
