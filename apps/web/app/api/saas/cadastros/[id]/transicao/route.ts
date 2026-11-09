import { z } from "zod";
import { requireSaasRole } from "@/server/authz/gates";
import { transitionCadastro } from "@/server/cadastro/service";
import { readJson } from "@/server/http/request";
import { fail, handleError, ok } from "@/server/http/respond";

const schema = z.object({
  para: z.enum(["aprovado", "recusado"]),
  motivo_recusa: z.string().optional(),
});

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireSaasRole("admin", "vendedor");
    const { id } = await ctx.params;
    const parsed = schema.safeParse(await readJson(req));
    if (!parsed.success) return fail("validacao", "Transição inválida.");
    return ok(
      await transitionCadastro(session, id, parsed.data.para, parsed.data.motivo_recusa),
    );
  } catch (err) {
    return handleError(err);
  }
}
