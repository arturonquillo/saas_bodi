import { requireSaasRole } from "@/server/authz/gates";
import { faturarPedido } from "@/server/sales/venda";
import { handleError, ok } from "@/server/http/respond";

export async function POST(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireSaasRole("admin", "vendedor");
    const { id } = await ctx.params;
    return ok(await faturarPedido(session, id), 201);
  } catch (err) {
    return handleError(err);
  }
}
