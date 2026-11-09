import { z } from "zod";
import { requireSaasRole } from "@/server/authz/gates";
import { testarAutomacao } from "@/server/crm/automations";
import { ApiError, handleError, ok } from "@/server/http/respond";

const schema = z.object({
  sample: z.record(z.unknown()).optional(),
}).passthrough();

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireSaasRole("admin");
    const { id } = await ctx.params;
    const body = await req.json().catch(() => ({}));
    const parsed = schema.safeParse(body);
    if (!parsed.success) throw new ApiError("validacao", "Dados inválidos.");
    const sample = (parsed.data.sample ?? parsed.data) as Record<string, unknown>;
    return ok(await testarAutomacao(session, id, sample));
  } catch (err) {
    return handleError(err);
  }
}
