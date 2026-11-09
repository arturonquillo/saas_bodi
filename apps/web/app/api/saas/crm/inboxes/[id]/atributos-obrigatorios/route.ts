import { z } from "zod";
import { requireSaasRole } from "@/server/authz/gates";
import { putRequiredAttributesOnResolve } from "@/server/crm/channels";
import { ApiError, handleError, ok } from "@/server/http/respond";

const schema = z.object({ keys: z.array(z.string()) });

export async function PUT(req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireSaasRole("admin");
    const { id } = await ctx.params;
    const parsed = schema.safeParse(await req.json());
    if (!parsed.success) throw new ApiError("validacao", "Dados inválidos.");
    return ok(await putRequiredAttributesOnResolve(session, id, parsed.data));
  } catch (err) {
    return handleError(err);
  }
}
