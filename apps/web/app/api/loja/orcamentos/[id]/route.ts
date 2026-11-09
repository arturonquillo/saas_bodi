import { requireCustomer } from "@/server/authz/gates";
import { getLojaOrcamento } from "@/server/sales/orcamento";
import { handleError, ok } from "@/server/http/respond";

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireCustomer();
    const { id } = await ctx.params;
    return ok(await getLojaOrcamento(session, id));
  } catch (err) {
    return handleError(err);
  }
}
