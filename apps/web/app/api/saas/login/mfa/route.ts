import { z } from "zod";
import { completeMfaLogin } from "@/server/crm/security";
import { requireSession } from "@/server/authz/session";
import { toSessionDto } from "@/server/authz/to-session-dto";
import { ApiError, handleError, ok } from "@/server/http/respond";

const schema = z.object({
  mfa_token: z.string().min(1),
  code: z.string().min(1),
});

export async function POST(req: Request) {
  try {
    const parsed = schema.safeParse(await req.json());
    if (!parsed.success) throw new ApiError("validacao", "Dados inválidos.");
    await completeMfaLogin(parsed.data);
    const session = await requireSession("saas");
    return ok(toSessionDto(session));
  } catch (err) {
    return handleError(err);
  }
}
