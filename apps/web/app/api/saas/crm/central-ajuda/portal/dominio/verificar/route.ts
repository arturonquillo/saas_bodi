import { requireSaasRole } from "@/server/authz/gates";
import { verificarPortalDominio } from "@/server/crm/help-center";
import { handleError, ok } from "@/server/http/respond";

export async function POST() {
  try {
    const session = await requireSaasRole("admin");
    return ok(await verificarPortalDominio(session));
  } catch (err) {
    return handleError(err);
  }
}
