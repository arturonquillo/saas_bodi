import { z } from "zod";
import { requireSaasRole } from "@/server/authz/gates";
import { deleteLabel, patchLabel } from "@/server/crm/meta";
import { ApiError, handleError, ok } from "@/server/http/respond";

const patchSchema = z.object({
  title: z.string().optional(),
  color: z.string().optional(),
  show_on_sidebar: z.boolean().optional(),
});

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireSaasRole("admin", "vendedor");
    const { id } = await ctx.params;
    const parsed = patchSchema.safeParse(await req.json());
    if (!parsed.success) throw new ApiError("validacao", "Dados inválidos.");
    return ok(await patchLabel(session, id, parsed.data));
  } catch (err) {
    return handleError(err);
  }
}

export async function DELETE(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireSaasRole("admin", "vendedor");
    const { id } = await ctx.params;
    return ok(await deleteLabel(session, id));
  } catch (err) {
    return handleError(err);
  }
}

