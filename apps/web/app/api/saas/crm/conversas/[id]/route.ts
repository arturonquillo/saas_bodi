import { z } from "zod";
import { requireSaasRole } from "@/server/authz/gates";
import { getConversa, patchConversa } from "@/server/crm/conversations";
import { ApiError, handleError, ok } from "@/server/http/respond";

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireSaasRole("admin", "vendedor");
    const { id } = await ctx.params;
    return ok(await getConversa(session, id));
  } catch (err) {
    return handleError(err);
  }
}

const patchSchema = z.object({
  status: z.enum(["open", "pending", "snoozed", "resolved"]).optional(),
  priority: z.enum(["low", "medium", "high", "urgent"]).nullable().optional(),
  assignee_user_id: z.string().nullable().optional(),
  team_id: z.string().nullable().optional(),
  muted: z.boolean().optional(),
  snoozed_until: z.string().nullable().optional(),
  cliente_id: z.string().nullable().optional(),
  cadastro_request_id: z.string().nullable().optional(),
  orcamento_id: z.string().nullable().optional(),
});

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireSaasRole("admin", "vendedor");
    const { id } = await ctx.params;
    const parsed = patchSchema.safeParse(await req.json());
    if (!parsed.success) throw new ApiError("validacao", "Dados inválidos.");
    return ok(await patchConversa(session, id, parsed.data));
  } catch (err) {
    return handleError(err);
  }
}

