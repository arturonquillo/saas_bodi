import { requireSaasRole } from "@/server/authz/gates";
import { iniciarMfa } from "@/server/crm/security";
import { handleError, ok } from "@/server/http/respond";

export async function POST() {
  try {
    const session = await requireSaasRole("admin", "vendedor");
    return ok(await iniciarMfa(session));
  } catch (err) {
    return handleError(err);
  }
}
