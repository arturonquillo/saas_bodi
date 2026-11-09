import { z } from "zod";
import { getSaasConfig, putSaasConfig } from "@/server/config/service";
import { requireSaasRole } from "@/server/authz/gates";
import { readJson } from "@/server/http/request";
import { fail, handleError, ok } from "@/server/http/respond";

const schema = z.object({
  razao_social: z.string().optional(),
  nome_fantasia: z.string().optional(),
  whatsapp_comercial: z.string().nullable().optional(),
  canais_aviso: z.enum(["email", "whatsapp", "ambos"]).optional(),
  loja_modo: z.enum(["pedido_direto", "orcamento"]).optional(),
  default_vendedor_user_id: z.string().nullable().optional(),
});

export async function GET() {
  try {
    const session = await requireSaasRole("admin");
    return ok(await getSaasConfig(session));
  } catch (err) {
    return handleError(err);
  }
}

export async function PUT(req: Request) {
  try {
    const session = await requireSaasRole("admin");
    const parsed = schema.safeParse(await readJson(req));
    if (!parsed.success) return fail("validacao", "Configuração inválida.");
    return ok(await putSaasConfig(session, parsed.data));
  } catch (err) {
    return handleError(err);
  }
}
