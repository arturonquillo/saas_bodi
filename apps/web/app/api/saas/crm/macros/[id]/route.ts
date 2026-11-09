import { z } from "zod";
import { requireSaasRole } from "@/server/authz/gates";
import { deleteMacro, getMacro, patchMacro } from "@/server/crm/macros";
import { ApiError, handleError, ok } from "@/server/http/respond";

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireSaasRole("admin", "vendedor");
    const { id } = await ctx.params;
    return ok(await getMacro(session, id));
  } catch (err) {
    return handleError(err);
  }
}

const patchSchema = z.object({
  name: z.string().optional(),
  actions: z.array(z.unknown()).optional(),
  visibility: z.enum(["public", "private"]).optional(),
});

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireSaasRole("admin", "vendedor");
    const { id } = await ctx.params;
    const parsed = patchSchema.safeParse(await req.json());
    if (!parsed.success) throw new ApiError("validacao", "Dados inválidos.");
    return ok(
      await patchMacro(session, id, {
        ...parsed.data,
        actions: parsed.data.actions as never,
      }),
    );
  } catch (err) {
    return handleError(err);
  }
}

export async function DELETE(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireSaasRole("admin", "vendedor");
    const { id } = await ctx.params;
    return ok(await deleteMacro(session, id));
  } catch (err) {
    return handleError(err);
  }
}
