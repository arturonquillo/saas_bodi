import { z } from "zod";
import { requireSaasRole } from "@/server/authz/gates";
import { transitionOrcamento } from "@/server/sales/orcamento";
import { readJson } from "@/server/http/request";
import { fail, handleError, ok } from "@/server/http/respond";

const schema = z.object({
  para: z.enum(["enviado", "aceito", "recusado", "expirado", "cancelado"]),
});

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireSaasRole("admin", "vendedor");
    const { id } = await ctx.params;
    const parsed = schema.safeParse(await readJson(req));
    if (!parsed.success) return fail("validacao", "Informe o status de destino.");
    return ok(await transitionOrcamento(session, id, parsed.data.para, false));
  } catch (err) {
    return handleError(err);
  }
}
