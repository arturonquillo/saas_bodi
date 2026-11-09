import { z } from "zod";
import { requireSaasRole } from "@/server/authz/gates";
import { setConversationLabels } from "@/server/crm/conversations";
import { ApiError, handleError, ok } from "@/server/http/respond";

const schema = z.object({
  label_ids: z.array(z.string()),
  mode: z.enum(["replace", "add"]).optional(),
});

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireSaasRole("admin", "vendedor");
    const { id } = await ctx.params;
    const parsed = schema.safeParse(await req.json());
    if (!parsed.success) throw new ApiError("validacao", "Dados inválidos.");
    return ok(await setConversationLabels(session, id, parsed.data.label_ids, parsed.data.mode ?? "replace"));
  } catch (err) {
    return handleError(err);
  }
}

