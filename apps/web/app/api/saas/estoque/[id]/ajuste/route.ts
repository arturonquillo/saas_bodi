import { z } from "zod";
import { requireSaasRole } from "@/server/authz/gates";
import { adjustOnHand } from "@/server/inventory/service";
import { readJson } from "@/server/http/request";
import { fail, handleError, ok } from "@/server/http/respond";

const schema = z.object({
  delta: z.number().int(),
  reason: z.string().min(1),
});

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireSaasRole("admin");
    const { id } = await ctx.params;
    const parsed = schema.safeParse(await readJson(req));
    if (!parsed.success) return fail("validacao", "Ajuste inválido.");
    return ok(await adjustOnHand(session, id, parsed.data.delta, parsed.data.reason));
  } catch (err) {
    return handleError(err);
  }
}
