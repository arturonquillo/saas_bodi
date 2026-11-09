import { z } from "zod";
import { requireSaasRole } from "@/server/authz/gates";
import { putDraft } from "@/server/crm/conversations";
import { ApiError, handleError, ok } from "@/server/http/respond";

const schema = z.object({ body: z.string() });

export async function PUT(req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireSaasRole("admin", "vendedor");
    const { id } = await ctx.params;
    const parsed = schema.safeParse(await req.json());
    if (!parsed.success) throw new ApiError("validacao", "Dados inválidos.");
    return ok(await putDraft(session, id, parsed.data.body));
  } catch (err) {
    return handleError(err);
  }
}

