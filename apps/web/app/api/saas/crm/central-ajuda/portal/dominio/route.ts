import { z } from "zod";
import { requireSaasRole } from "@/server/authz/gates";
import { putPortalDominio } from "@/server/crm/help-center";
import { ApiError, handleError, ok } from "@/server/http/respond";

const schema = z.object({ custom_domain: z.string().nullable() });

export async function PUT(req: Request) {
  try {
    const session = await requireSaasRole("admin");
    const parsed = schema.safeParse(await req.json());
    if (!parsed.success) throw new ApiError("validacao", "Dados inválidos.");
    return ok(await putPortalDominio(session, parsed.data));
  } catch (err) {
    return handleError(err);
  }
}
