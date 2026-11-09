import { z } from "zod";
import { requireSaasRole } from "@/server/authz/gates";
import { patchUsuario } from "@/server/users/service";
import { readJson } from "@/server/http/request";
import { fail, handleError, ok } from "@/server/http/respond";

const schema = z.object({
  ativo: z.boolean().optional(),
  saas_role: z.enum(["admin", "vendedor"]).optional(),
  custom_role_id: z.string().nullable().optional(),
});

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireSaasRole("admin");
    const { id } = await ctx.params;
    const parsed = schema.safeParse(await readJson(req));
    if (!parsed.success) return fail("validacao", "Dados inválidos.");
    return ok(await patchUsuario(session, id, parsed.data));
  } catch (err) {
    return handleError(err);
  }
}
