import { z } from "zod";
import { requireSaasRole } from "@/server/authz/gates";
import { getBotInboxes, putBotInboxes } from "@/server/crm/bots";
import { ApiError, handleError, ok } from "@/server/http/respond";

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireSaasRole("admin");
    const { id } = await ctx.params;
    return ok(await getBotInboxes(session, id));
  } catch (err) {
    return handleError(err);
  }
}

const putSchema = z.object({
  inbox_ids: z.array(z.string()),
});

export async function PUT(req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireSaasRole("admin");
    const { id } = await ctx.params;
    const parsed = putSchema.safeParse(await req.json());
    if (!parsed.success) throw new ApiError("validacao", "Dados inválidos.");
    return ok(await putBotInboxes(session, id, parsed.data.inbox_ids));
  } catch (err) {
    return handleError(err);
  }
}
