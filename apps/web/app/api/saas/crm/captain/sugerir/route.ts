import { z } from "zod";
import { requireSaasRole } from "@/server/authz/gates";
import { sugerirCaptain } from "@/server/crm/captain";
import { ApiError, handleError, ok } from "@/server/http/respond";

const schema = z.object({
  conversation_id: z.string().min(1),
  mode: z.enum(["copilot", "triage", "monitor", "assistant"]),
  assistant_id: z.string().optional(),
});

export async function POST(req: Request) {
  try {
    const session = await requireSaasRole("admin", "vendedor");
    const parsed = schema.safeParse(await req.json());
    if (!parsed.success) throw new ApiError("validacao", "Dados inválidos.");
    return ok(await sugerirCaptain(session, parsed.data));
  } catch (err) {
    return handleError(err);
  }
}
