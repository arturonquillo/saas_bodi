import { requireSaasRole } from "@/server/authz/gates";
import { getVenda } from "@/server/sales/venda";
import { handleError, ok } from "@/server/http/respond";

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireSaasRole("admin", "vendedor");
    const { id } = await ctx.params;
    return ok(await getVenda(session, id));
  } catch (err) {
    return handleError(err);
  }
}
