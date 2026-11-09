import { requireSaasRole } from "@/server/authz/gates";
import { captainStatus } from "@/server/crm/captain";
import { handleError, ok } from "@/server/http/respond";

export async function GET() {
  try {
    const session = await requireSaasRole("admin");
    return ok(await captainStatus(session));
  } catch (err) {
    return handleError(err);
  }
}
