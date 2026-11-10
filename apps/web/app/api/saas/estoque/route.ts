import { z } from "zod";
import { SKU_UNIDADES } from "@saas-frota/shared";
import { requireSaasRole } from "@/server/authz/gates";
import { createSku, listEstoque } from "@/server/inventory/service";
import { readJson } from "@/server/http/request";
import { fail, handleError, ok } from "@/server/http/respond";

const createSchema = z.object({
  codigo: z.string().min(1),
  nome: z.string().min(1),
  descricao: z.string().max(500).nullable().optional(),
  unidade: z.enum(SKU_UNIDADES).optional(),
  preco_atacado_centavos: z.number().int().nonnegative(),
  desconto_max_pct: z.number().int().min(0).max(100).optional(),
  qtd_min_atacado: z.number().int().positive().optional(),
  on_hand: z.number().int().nonnegative().optional(),
  visivel_loja: z.boolean().optional(),
  ativo: z.boolean().optional(),
});

export async function GET(req: Request) {
  try {
    const session = await requireSaasRole("admin", "vendedor");
    return ok(await listEstoque(session, new URL(req.url)));
  } catch (err) {
    return handleError(err);
  }
}

export async function POST(req: Request) {
  try {
    const session = await requireSaasRole("admin");
    const parsed = createSchema.safeParse(await readJson(req));
    if (!parsed.success) return fail("validacao", "SKU inválido.");
    return ok(await createSku(session, parsed.data), 201);
  } catch (err) {
    return handleError(err);
  }
}
