import { z } from "zod";
import { requireSaasRole } from "@/server/authz/gates";
import { createEmpresa, listEmpresas } from "@/server/crm/contacts";
import { ApiError, handleError, ok } from "@/server/http/respond";

export async function GET(req: Request) {
  try {
    const session = await requireSaasRole("admin", "vendedor");
    return ok(await listEmpresas(session, new URL(req.url)));
  } catch (err) {
    return handleError(err);
  }
}

const postSchema = z.object({
  cnpj: z.string().min(1),
  razao_social: z.string().min(1),
  nome_fantasia: z.string().nullable().optional(),
  cnpj_registro_pendente: z.boolean().optional(),
});

export async function POST(req: Request) {
  try {
    const session = await requireSaasRole("admin", "vendedor");
    const parsed = postSchema.safeParse(await req.json());
    if (!parsed.success) throw new ApiError("validacao", "Dados inválidos.");
    return ok(await createEmpresa(session, parsed.data), 201);
  } catch (err) {
    return handleError(err);
  }
}

