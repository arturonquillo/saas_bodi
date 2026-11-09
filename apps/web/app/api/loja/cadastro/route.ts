import { z } from "zod";
import { submitLojaCadastro } from "@/server/cadastro/service";
import { assertRateLimit } from "@/server/identity/rate-limit";
import { clientIp, publicTenantSlug, readJson } from "@/server/http/request";
import { fail, handleError, ok } from "@/server/http/respond";

const schema = z.object({
  cnpj: z.string().min(14),
  contato_nome: z.string().min(1),
  email: z.string().email(),
  whatsapp: z.string().min(8),
  senha: z.string().min(8),
  razao_social: z.string().optional(),
  tenant: z.string().optional(),
});

export async function POST(req: Request) {
  try {
    assertRateLimit(`cadastro:${clientIp(req)}`, 10, 60_000);
    const parsed = schema.safeParse(await readJson(req));
    if (!parsed.success) return fail("validacao", "Dados de cadastro inválidos.");
    const data = await submitLojaCadastro({
      ...parsed.data,
      tenantSlug: parsed.data.tenant ?? publicTenantSlug(req),
    });
    return ok(data, 201);
  } catch (err) {
    return handleError(err);
  }
}
