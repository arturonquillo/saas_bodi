import { z } from "zod";
import { requireSaasRole } from "@/server/authz/gates";
import { deleteAppPainel, getAppPainel, patchAppPainel } from "@/server/crm/dashboard-apps";
import { ApiError, handleError, ok } from "@/server/http/respond";

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireSaasRole("admin");
    const { id } = await ctx.params;
    return ok(await getAppPainel(session, id));
  } catch (err) {
    return handleError(err);
  }
}

const schema = z.object({
  title: z.string().min(1).optional(),
  url: z.string().min(1).optional(),
  enabled: z.boolean().optional(),
  inbox_ids: z.array(z.string()).nullable().optional(),
  position: z.number().int().optional(),
});

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireSaasRole("admin");
    const { id } = await ctx.params;
    const parsed = schema.safeParse(await req.json());
    if (!parsed.success) throw new ApiError("validacao", "Dados inválidos.");
    return ok(await patchAppPainel(session, id, parsed.data));
  } catch (err) {
    return handleError(err);
  }
}

export async function DELETE(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireSaasRole("admin");
    const { id } = await ctx.params;
    return ok(await deleteAppPainel(session, id));
  } catch (err) {
    return handleError(err);
  }
}
