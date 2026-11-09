import { z } from "zod";
import { requireSaasRole } from "@/server/authz/gates";
import { putInboxDefaultSla } from "@/server/crm/sla";
import { ApiError, handleError, ok } from "@/server/http/respond";

const schema = z.object({
  sla_policy_id: z.string().nullable(),
});

export async function PUT(req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireSaasRole("admin");
    const { id } = await ctx.params;
    const parsed = schema.safeParse(await req.json());
    if (!parsed.success) throw new ApiError("validacao", "Dados inválidos.");
    return ok(await putInboxDefaultSla(session, id, parsed.data));
  } catch (err) {
    return handleError(err);
  }
}
