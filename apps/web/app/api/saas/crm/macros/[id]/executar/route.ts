import { z } from "zod";
import { requireSaasRole } from "@/server/authz/gates";
import { executarMacro } from "@/server/crm/macros";
import { ApiError, handleError, ok } from "@/server/http/respond";

const schema = z.object({
  conversation_ids: z.array(z.string()).min(1),
});

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireSaasRole("admin", "vendedor");
    const { id } = await ctx.params;
    const parsed = schema.safeParse(await req.json());
    if (!parsed.success) throw new ApiError("validacao", "Dados inválidos.");
    return ok(await executarMacro(session, id, parsed.data.conversation_ids));
  } catch (err) {
    return handleError(err);
  }
}
