import { z } from "zod";
import { requireCustomer } from "@/server/authz/gates";
import { transitionOrcamento } from "@/server/sales/orcamento";
import { readJson } from "@/server/http/request";
import { fail, handleError, ok } from "@/server/http/respond";

const schema = z.object({ para: z.enum(["aceito", "recusado"]) });

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireCustomer();
    const { id } = await ctx.params;
    const parsed = schema.safeParse(await readJson(req));
    if (!parsed.success) return fail("validacao", "Informe o status de destino.");
    return ok(await transitionOrcamento(session, id, parsed.data.para, true));
  } catch (err) {
    return handleError(err);
  }
}
