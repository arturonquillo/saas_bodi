import { z } from "zod";
import { requireSaasRole } from "@/server/authz/gates";
import { createOrcamento, listSaasOrcamentos } from "@/server/sales/orcamento";
import { readJson } from "@/server/http/request";
import { fail, handleError, ok } from "@/server/http/respond";

const createSchema = z.object({
  cliente_id: z.string().optional(),
  cadastro_request_id: z.string().optional(),
  channel: z.enum(["saas", "whatsapp", "loja"]).optional(),
  valido_ate: z.string().optional(),
  linhas: z
    .array(
      z.object({
        sku_id: z.string().min(1),
        qty: z.number().int().positive(),
        desconto_pct: z.number().int().min(0).max(100).optional(),
        notas: z.string().optional(),
      }),
    )
    .min(1),
});

export async function GET(req: Request) {
  try {
    const session = await requireSaasRole("admin", "vendedor");
    return ok(await listSaasOrcamentos(session, new URL(req.url)));
  } catch (err) {
    return handleError(err);
  }
}

export async function POST(req: Request) {
  try {
    const session = await requireSaasRole("admin", "vendedor");
    const parsed = createSchema.safeParse(await readJson(req));
    if (!parsed.success) return fail("validacao", "Orçamento inválido.");
    return ok(await createOrcamento(session, parsed.data), 201);
  } catch (err) {
    return handleError(err);
  }
}
