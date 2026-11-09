import { z } from "zod";
import { requireSaasRole } from "@/server/authz/gates";
import { patchTeam } from "@/server/crm/meta";
import { ApiError, handleError, ok } from "@/server/http/respond";

const patchSchema = z.object({ name: z.string().min(1) });

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireSaasRole("admin");
    const { id } = await ctx.params;
    const parsed = patchSchema.safeParse(await req.json());
    if (!parsed.success) throw new ApiError("validacao", "Dados inválidos.");
    return ok(await patchTeam(session, id, parsed.data.name));
  } catch (err) {
    return handleError(err);
  }
}

