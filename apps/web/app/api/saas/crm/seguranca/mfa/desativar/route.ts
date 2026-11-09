import { z } from "zod";
import { requireSaasRole } from "@/server/authz/gates";
import { desativarMfa } from "@/server/crm/security";
import { ApiError, handleError, ok } from "@/server/http/respond";

const schema = z.object({ code: z.string().optional() });

export async function POST(req: Request) {
  try {
    const session = await requireSaasRole("admin", "vendedor");
    const parsed = schema.safeParse(await req.json().catch(() => ({})));
    if (!parsed.success) throw new ApiError("validacao", "Dados inválidos.");
    return ok(await desativarMfa(session, parsed.data));
  } catch (err) {
    return handleError(err);
  }
}
