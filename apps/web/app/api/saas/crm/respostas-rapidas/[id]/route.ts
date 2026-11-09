import { z } from "zod";
import { requireSaasRole } from "@/server/authz/gates";
import { deleteCanned, patchCanned } from "@/server/crm/meta";
import { ApiError, handleError, ok } from "@/server/http/respond";

const patchSchema = z.object({
  short_code: z.string().optional(),
  content: z.string().optional(),
});

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireSaasRole("admin", "vendedor");
    const { id } = await ctx.params;
    const parsed = patchSchema.safeParse(await req.json());
    if (!parsed.success) throw new ApiError("validacao", "Dados inválidos.");
    return ok(await patchCanned(session, id, parsed.data));
  } catch (err) {
    return handleError(err);
  }
}

export async function DELETE(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireSaasRole("admin", "vendedor");
    const { id } = await ctx.params;
    return ok(await deleteCanned(session, id));
  } catch (err) {
    return handleError(err);
  }
}

