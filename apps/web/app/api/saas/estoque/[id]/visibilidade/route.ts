import { z } from "zod";
import { requireSaasRole } from "@/server/authz/gates";
import { toggleVisibilidade } from "@/server/inventory/service";
import { readJson } from "@/server/http/request";
import { fail, handleError, ok } from "@/server/http/respond";

const schema = z.object({ visivel_loja: z.boolean() });

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireSaasRole("admin");
    const { id } = await ctx.params;
    const parsed = schema.safeParse(await readJson(req));
    if (!parsed.success) return fail("validacao", "Visibilidade inválida.");
    return ok(await toggleVisibilidade(session, id, parsed.data.visivel_loja));
  } catch (err) {
    return handleError(err);
  }
}
