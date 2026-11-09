import { z } from "zod";
import { requireSaasRole } from "@/server/authz/gates";
import { deleteWebhook, getWebhook, patchWebhook } from "@/server/crm/webhooks";
import { ApiError, handleError, ok } from "@/server/http/respond";

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireSaasRole("admin");
    const { id } = await ctx.params;
    return ok(await getWebhook(session, id));
  } catch (err) {
    return handleError(err);
  }
}

const patchSchema = z.object({
  url: z.string().optional(),
  name: z.string().nullable().optional(),
  subscriptions: z.array(z.string()).optional(),
  inbox_id: z.string().nullable().optional(),
  active: z.boolean().optional(),
});

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireSaasRole("admin");
    const { id } = await ctx.params;
    const parsed = patchSchema.safeParse(await req.json());
    if (!parsed.success) throw new ApiError("validacao", "Dados inválidos.");
    return ok(await patchWebhook(session, id, parsed.data));
  } catch (err) {
    return handleError(err);
  }
}

export async function DELETE(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireSaasRole("admin");
    const { id } = await ctx.params;
    return ok(await deleteWebhook(session, id));
  } catch (err) {
    return handleError(err);
  }
}
