import { z } from "zod";
import { requireSaasRole } from "@/server/authz/gates";
import { getSaml, putSaml } from "@/server/crm/security";
import { ApiError, handleError, ok } from "@/server/http/respond";

export async function GET() {
  try {
    const session = await requireSaasRole("admin");
    return ok(await getSaml(session));
  } catch (err) {
    return handleError(err);
  }
}

const schema = z.object({
  enabled: z.boolean().optional(),
  idp_entity_id: z.string().nullable().optional(),
  idp_sso_url: z.string().nullable().optional(),
  idp_certificate_pem: z.string().nullable().optional(),
  sp_entity_id: z.string().nullable().optional(),
  jit_provision: z.boolean().optional(),
});

export async function PUT(req: Request) {
  try {
    const session = await requireSaasRole("admin");
    const parsed = schema.safeParse(await req.json());
    if (!parsed.success) throw new ApiError("validacao", "Dados inválidos.");
    return ok(await putSaml(session, parsed.data));
  } catch (err) {
    return handleError(err);
  }
}
