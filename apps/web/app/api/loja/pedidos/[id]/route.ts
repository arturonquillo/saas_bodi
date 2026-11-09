import { requireCustomer } from "@/server/authz/gates";
import { getLojaPedido } from "@/server/sales/pedido";
import { handleError, ok } from "@/server/http/respond";

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireCustomer();
    const { id } = await ctx.params;
    return ok(await getLojaPedido(session, id));
  } catch (err) {
    return handleError(err);
  }
}
