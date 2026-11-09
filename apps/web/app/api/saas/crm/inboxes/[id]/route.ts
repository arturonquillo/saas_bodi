import { z } from "zod";
import { requireSaasRole } from "@/server/authz/gates";
import { getInbox, patchInbox } from "@/server/crm/inboxes";
import { ApiError, handleError, ok } from "@/server/http/respond";

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireSaasRole("admin", "vendedor");
    const { id } = await ctx.params;
    return ok(await getInbox(session, id));
  } catch (err) {
    return handleError(err);
  }
}

const patchSchema = z.object({
  name: z.string().optional(),
  greeting: z.string().nullable().optional(),
  ooo_message: z.string().nullable().optional(),
  csat_enabled: z.boolean().optional(),
  lock_to_single_conversation: z.boolean().optional(),
  allow_auto_assign: z.boolean().optional(),
  vendedor_see_all: z.boolean().optional(),
});

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireSaasRole("admin");
    const { id } = await ctx.params;
    const parsed = patchSchema.safeParse(await req.json());
    if (!parsed.success) throw new ApiError("validacao", "Dados inválidos.");
    return ok(await patchInbox(session, id, parsed.data));
  } catch (err) {
    return handleError(err);
  }
}

