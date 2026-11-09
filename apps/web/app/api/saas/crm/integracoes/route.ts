import { requireSaasRole } from "@/server/authz/gates";
import { listIntegracoes } from "@/server/crm/integrations";
import { handleError, ok } from "@/server/http/respond";

export async function GET() {
  try {
    const session = await requireSaasRole("admin");
    return ok(await listIntegracoes(session));
  } catch (err) {
    return handleError(err);
  }
}
