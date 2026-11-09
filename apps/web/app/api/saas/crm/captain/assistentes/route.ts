import { z } from "zod";
import { requireSaasRole } from "@/server/authz/gates";
import { createAssistente, listAssistentes } from "@/server/crm/captain";
import { ApiError, handleError, ok } from "@/server/http/respond";

export async function GET() {
  try {
    const session = await requireSaasRole("admin");
    return ok(await listAssistentes(session));
  } catch (err) {
    return handleError(err);
  }
}

const schema = z.object({
  name: z.string().min(1),
  mode: z.enum(["copilot", "triage", "monitor", "assistant"]),
  system_prompt_stub: z.string().nullable().optional(),
  active: z.boolean().optional(),
  config: z.record(z.string(), z.unknown()).nullable().optional(),
});

export async function POST(req: Request) {
  try {
    const session = await requireSaasRole("admin");
    const parsed = schema.safeParse(await req.json());
    if (!parsed.success) throw new ApiError("validacao", "Dados inválidos.");
    return ok(await createAssistente(session, parsed.data));
  } catch (err) {
    return handleError(err);
  }
}
