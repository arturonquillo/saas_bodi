import { z } from "zod";
import { requireSaasRole } from "@/server/authz/gates";
import { deleteAssistente, getAssistente, patchAssistente } from "@/server/crm/captain";
import { ApiError, handleError, ok } from "@/server/http/respond";

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireSaasRole("admin");
    const { id } = await ctx.params;
    return ok(await getAssistente(session, id));
  } catch (err) {
    return handleError(err);
  }
}

const schema = z.object({
  name: z.string().min(1).optional(),
  mode: z.enum(["copilot", "triage", "monitor", "assistant"]).optional(),
  system_prompt_stub: z.string().nullable().optional(),
  active: z.boolean().optional(),
  config: z.record(z.string(), z.unknown()).nullable().optional(),
});

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireSaasRole("admin");
    const { id } = await ctx.params;
    const parsed = schema.safeParse(await req.json());
    if (!parsed.success) throw new ApiError("validacao", "Dados inválidos.");
    return ok(await patchAssistente(session, id, parsed.data));
  } catch (err) {
    return handleError(err);
  }
}

export async function DELETE(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireSaasRole("admin");
    const { id } = await ctx.params;
    return ok(await deleteAssistente(session, id));
  } catch (err) {
    return handleError(err);
  }
}
