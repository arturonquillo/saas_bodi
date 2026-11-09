import { z } from "zod";
import { requireSaasRole } from "@/server/authz/gates";
import { getEstoque, patchSku } from "@/server/inventory/service";
import { readJson } from "@/server/http/request";
import { fail, handleError, ok } from "@/server/http/respond";

const patchSchema = z.object({
  nome: z.string().min(1).optional(),
  preco_atacado_centavos: z.number().int().nonnegative().optional(),
  qtd_min_atacado: z.number().int().positive().optional(),
});

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireSaasRole("admin", "vendedor");
    const { id } = await ctx.params;
    return ok(await getEstoque(session, id));
  } catch (err) {
    return handleError(err);
  }
}

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireSaasRole("admin");
    const { id } = await ctx.params;
    const parsed = patchSchema.safeParse(await readJson(req));
    if (!parsed.success) return fail("validacao", "Dados inválidos.");
    return ok(await patchSku(session, id, parsed.data));
  } catch (err) {
    return handleError(err);
  }
}
