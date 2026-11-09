import { requireSaasRole } from "@/server/authz/gates";
import { getMfaStatus } from "@/server/crm/security";
import { handleError, ok } from "@/server/http/respond";

export async function GET() {
  try {
    const session = await requireSaasRole("admin", "vendedor");
    return ok(await getMfaStatus(session));
  } catch (err) {
    return handleError(err);
  }
}
