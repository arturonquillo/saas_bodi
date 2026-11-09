import { z } from "zod";
import { requireSaasRole } from "@/server/authz/gates";
import { confirmarMfa } from "@/server/crm/security";
import { ApiError, handleError, ok } from "@/server/http/respond";

const schema = z.object({ code: z.string().min(1) });

export async function POST(req: Request) {
  try {
    const session = await requireSaasRole("admin", "vendedor");
    const parsed = schema.safeParse(await req.json());
    if (!parsed.success) throw new ApiError("validacao", "Dados inválidos.");
    return ok(await confirmarMfa(session, parsed.data));
  } catch (err) {
    return handleError(err);
  }
}
