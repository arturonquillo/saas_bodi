import { z } from "zod";
import { requireSaasRole } from "@/server/authz/gates";
import { getNotificacaoPrefs, putNotificacaoPrefs } from "@/server/crm/meta";
import { ApiError, handleError, ok } from "@/server/http/respond";

export async function GET() {
  try {
    const session = await requireSaasRole("admin", "vendedor");
    return ok(await getNotificacaoPrefs(session));
  } catch (err) {
    return handleError(err);
  }
}

const putSchema = z.object({
  assigned: z.boolean().optional(),
  unassigned_conversation: z.boolean().optional(),
  conversation_activity: z.boolean().optional(),
  email_enabled: z.boolean().optional(),
});

export async function PUT(req: Request) {
  try {
    const session = await requireSaasRole("admin", "vendedor");
    const parsed = putSchema.safeParse(await req.json());
    if (!parsed.success) throw new ApiError("validacao", "Dados inválidos.");
    return ok(await putNotificacaoPrefs(session, parsed.data));
  } catch (err) {
    return handleError(err);
  }
}

