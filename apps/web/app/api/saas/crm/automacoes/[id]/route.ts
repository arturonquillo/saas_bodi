import { z } from "zod";
import { requireSaasRole } from "@/server/authz/gates";
import { deleteAutomacao, getAutomacao, patchAutomacao } from "@/server/crm/automations";
import { ApiError, handleError, ok } from "@/server/http/respond";

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireSaasRole("admin");
    const { id } = await ctx.params;
    return ok(await getAutomacao(session, id));
  } catch (err) {
    return handleError(err);
  }
}

const patchSchema = z.object({
  name: z.string().optional(),
  description: z.string().nullable().optional(),
  event_name: z.string().optional(),
  conditions: z.unknown().optional(),
  actions: z.array(z.unknown()).optional(),
  active: z.boolean().optional(),
});

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireSaasRole("admin");
    const { id } = await ctx.params;
    const parsed = patchSchema.safeParse(await req.json());
    if (!parsed.success) throw new ApiError("validacao", "Dados inválidos.");
    return ok(
      await patchAutomacao(session, id, {
        ...parsed.data,
        conditions: parsed.data.conditions as never,
        actions: parsed.data.actions as never,
      }),
    );
  } catch (err) {
    return handleError(err);
  }
}

export async function DELETE(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireSaasRole("admin");
    const { id } = await ctx.params;
    return ok(await deleteAutomacao(session, id));
  } catch (err) {
    return handleError(err);
  }
}
