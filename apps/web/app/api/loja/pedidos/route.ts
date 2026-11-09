import { z } from "zod";
import { requireCustomer } from "@/server/authz/gates";
import { createLojaPedido, listLojaPedidos } from "@/server/sales/pedido";
import { readJson } from "@/server/http/request";
import { fail, handleError, ok } from "@/server/http/respond";

const createSchema = z.object({
  linhas: z.array(z.object({ sku_id: z.string().min(1), qty: z.number().int().positive() })).min(1),
});

export async function GET(req: Request) {
  try {
    const session = await requireCustomer();
    return ok(await listLojaPedidos(session, new URL(req.url)));
  } catch (err) {
    return handleError(err);
  }
}

export async function POST(req: Request) {
  try {
    const session = await requireCustomer();
    const parsed = createSchema.safeParse(await readJson(req));
    if (!parsed.success) return fail("validacao", "Linhas do pedido inválidas.");
    return ok(await createLojaPedido(session, parsed.data.linhas), 201);
  } catch (err) {
    return handleError(err);
  }
}
