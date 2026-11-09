import { z } from "zod";
import { requireSaasRole } from "@/server/authz/gates";
import { getEmpresa, patchEmpresa } from "@/server/crm/contacts";
import { ApiError, handleError, ok } from "@/server/http/respond";

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireSaasRole("admin", "vendedor");
    const { id } = await ctx.params;
    return ok(await getEmpresa(session, id));
  } catch (err) {
    return handleError(err);
  }
}

const patchSchema = z.object({
  razao_social: z.string().optional(),
  nome_fantasia: z.string().nullable().optional(),
  cnpj_registro_pendente: z.boolean().optional(),
});

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireSaasRole("admin", "vendedor");
    const { id } = await ctx.params;
    const parsed = patchSchema.safeParse(await req.json());
    if (!parsed.success) throw new ApiError("validacao", "Dados inválidos.");
    return ok(await patchEmpresa(session, id, parsed.data));
  } catch (err) {
    return handleError(err);
  }
}

