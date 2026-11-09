import { z } from "zod";
import { requireSaasRole } from "@/server/authz/gates";
import { deleteFiltro, patchFiltro } from "@/server/crm/filters";
import { ApiError, handleError, ok } from "@/server/http/respond";

const patchSchema = z.object({
  name: z.string().optional(),
  query: z.record(z.unknown()).optional(),
});

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireSaasRole("admin", "vendedor");
    const { id } = await ctx.params;
    const parsed = patchSchema.safeParse(await req.json());
    if (!parsed.success) throw new ApiError("validacao", "Dados inválidos.");
    return ok(await patchFiltro(session, id, parsed.data));
  } catch (err) {
    return handleError(err);
  }
}

export async function DELETE(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireSaasRole("admin", "vendedor");
    const { id } = await ctx.params;
    return ok(await deleteFiltro(session, id));
  } catch (err) {
    return handleError(err);
  }
}
