import { z } from "zod";
import { requireSaasRole } from "@/server/authz/gates";
import { putPoliticaSeguranca } from "@/server/crm/security";
import { ApiError, handleError, ok } from "@/server/http/respond";

const schema = z.object({
  mfa_required: z.boolean().optional(),
  saml_enabled: z.boolean().optional(),
  jit_provision: z.boolean().optional(),
});

export async function PUT(req: Request) {
  try {
    const session = await requireSaasRole("admin");
    const parsed = schema.safeParse(await req.json());
    if (!parsed.success) throw new ApiError("validacao", "Dados inválidos.");
    return ok(await putPoliticaSeguranca(session, parsed.data));
  } catch (err) {
    return handleError(err);
  }
}
