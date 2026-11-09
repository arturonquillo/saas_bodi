import { z } from "zod";
import { requireSaasRole } from "@/server/authz/gates";
import { createSaasPedido, listSaasPedidos } from "@/server/sales/pedido";
import { readJson } from "@/server/http/request";
import { fail, handleError, ok } from "@/server/http/respond";

const createSchema = z.object({
  cliente_id: z.string().min(1),
  linhas: z.array(z.object({ sku_id: z.string().min(1), qty: z.number().int().positive() })).min(1),
});

export async function GET(req: Request) {
  try {
    const session = await requireSaasRole("admin", "vendedor");
    return ok(await listSaasPedidos(session, new URL(req.url)));
  } catch (err) {
    return handleError(err);
  }
}

export async function POST(req: Request) {
  try {
    const session = await requireSaasRole("admin", "vendedor");
    const parsed = createSchema.safeParse(await readJson(req));
    if (!parsed.success) return fail("validacao", "Pedido inválido.");
    return ok(await createSaasPedido(session, parsed.data), 201);
  } catch (err) {
    return handleError(err);
  }
}
