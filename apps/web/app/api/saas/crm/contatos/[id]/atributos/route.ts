import { z } from "zod";
import { requireSaasRole } from "@/server/authz/gates";
import { patchContatoAtributos } from "@/server/crm/attributes";
import { ApiError, handleError, ok } from "@/server/http/respond";

const schema = z.object({
  attributes: z.record(z.unknown()),
});

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireSaasRole("admin", "vendedor");
    const { id } = await ctx.params;
    const parsed = schema.safeParse(await req.json());
    if (!parsed.success) throw new ApiError("validacao", "Dados inválidos.");
    return ok(await patchContatoAtributos(session, id, parsed.data.attributes));
  } catch (err) {
    return handleError(err);
  }
}
