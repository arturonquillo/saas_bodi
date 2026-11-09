import { z } from "zod";
import { requireSaasRole } from "@/server/authz/gates";
import { getInboxMembers, putInboxMembers } from "@/server/crm/inboxes";
import { ApiError, handleError, ok } from "@/server/http/respond";

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireSaasRole("admin");
    const { id } = await ctx.params;
    return ok(await getInboxMembers(session, id));
  } catch (err) {
    return handleError(err);
  }
}

const putSchema = z.object({ user_ids: z.array(z.string()) });

export async function PUT(req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireSaasRole("admin");
    const { id } = await ctx.params;
    const parsed = putSchema.safeParse(await req.json());
    if (!parsed.success) throw new ApiError("validacao", "Dados inválidos.");
    return ok(await putInboxMembers(session, id, parsed.data.user_ids));
  } catch (err) {
    return handleError(err);
  }
}

