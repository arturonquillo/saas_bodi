import { z } from "zod";
import { requireSaasRole } from "@/server/authz/gates";
import { deleteBot, getBot, patchBot } from "@/server/crm/bots";
import { ApiError, handleError, ok } from "@/server/http/respond";

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireSaasRole("admin");
    const { id } = await ctx.params;
    return ok(await getBot(session, id));
  } catch (err) {
    return handleError(err);
  }
}

const patchSchema = z.object({
  name: z.string().optional(),
  description: z.string().nullable().optional(),
  outgoing_url: z.string().optional(),
  active: z.boolean().optional(),
});

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireSaasRole("admin");
    const { id } = await ctx.params;
    const parsed = patchSchema.safeParse(await req.json());
    if (!parsed.success) throw new ApiError("validacao", "Dados inválidos.");
    return ok(await patchBot(session, id, parsed.data));
  } catch (err) {
    return handleError(err);
  }
}

export async function DELETE(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireSaasRole("admin");
    const { id } = await ctx.params;
    return ok(await deleteBot(session, id));
  } catch (err) {
    return handleError(err);
  }
}
