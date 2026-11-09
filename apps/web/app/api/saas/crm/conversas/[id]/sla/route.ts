import { z } from "zod";
import { requireSaasRole } from "@/server/authz/gates";
import {
  applyConversationSla,
  getConversationSla,
  removeConversationSla,
} from "@/server/crm/sla";
import { ApiError, handleError, ok } from "@/server/http/respond";

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireSaasRole("admin", "vendedor");
    const { id } = await ctx.params;
    return ok(await getConversationSla(session, id));
  } catch (err) {
    return handleError(err);
  }
}

const postSchema = z.object({ sla_policy_id: z.string().min(1) });

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireSaasRole("admin");
    const { id } = await ctx.params;
    const parsed = postSchema.safeParse(await req.json());
    if (!parsed.success) throw new ApiError("validacao", "Dados inválidos.");
    return ok(await applyConversationSla(session, id, parsed.data.sla_policy_id));
  } catch (err) {
    return handleError(err);
  }
}

export async function DELETE(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireSaasRole("admin");
    const { id } = await ctx.params;
    return ok(await removeConversationSla(session, id));
  } catch (err) {
    return handleError(err);
  }
}
