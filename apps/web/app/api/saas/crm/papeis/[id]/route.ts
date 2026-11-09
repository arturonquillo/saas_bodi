import { z } from "zod";
import { requireSaasRole } from "@/server/authz/gates";
import { deletePapel, getPapel, patchPapel } from "@/server/crm/custom-roles";
import { ApiError, handleError, ok } from "@/server/http/respond";

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireSaasRole("admin");
    const { id } = await ctx.params;
    return ok(await getPapel(session, id));
  } catch (err) {
    return handleError(err);
  }
}

const schema = z.object({
  name: z.string().min(1).optional(),
  description: z.string().nullable().optional(),
  permissions: z.array(z.string()).optional(),
});

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireSaasRole("admin");
    const { id } = await ctx.params;
    const parsed = schema.safeParse(await req.json());
    if (!parsed.success) throw new ApiError("validacao", "Dados inválidos.");
    return ok(await patchPapel(session, id, parsed.data));
  } catch (err) {
    return handleError(err);
  }
}

export async function DELETE(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireSaasRole("admin");
    const { id } = await ctx.params;
    return ok(await deletePapel(session, id));
  } catch (err) {
    return handleError(err);
  }
}
