import { requireSaasRole } from "@/server/authz/gates";
import { getSaasPedido } from "@/server/sales/pedido";
import { handleError, ok } from "@/server/http/respond";

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireSaasRole("admin", "vendedor");
    const { id } = await ctx.params;
    return ok(await getSaasPedido(session, id));
  } catch (err) {
    return handleError(err);
  }
}
