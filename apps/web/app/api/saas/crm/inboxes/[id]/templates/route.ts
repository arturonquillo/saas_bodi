import { z } from "zod";
import { requireSaasRole } from "@/server/authz/gates";
import { getTemplates, putTemplates } from "@/server/crm/inboxes";
import { ApiError, handleError, ok } from "@/server/http/respond";

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireSaasRole("admin");
    const { id } = await ctx.params;
    return ok(await getTemplates(session, id));
  } catch (err) {
    return handleError(err);
  }
}

const putSchema = z.object({ items: z.array(z.unknown()) });

export async function PUT(req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireSaasRole("admin");
    const { id } = await ctx.params;
    const body = await req.json();
    const parsed = putSchema.safeParse(Array.isArray(body) ? { items: body } : body);
    if (!parsed.success) throw new ApiError("validacao", "Dados inválidos.");
    return ok(await putTemplates(session, id, parsed.data.items));
  } catch (err) {
    return handleError(err);
  }
}

