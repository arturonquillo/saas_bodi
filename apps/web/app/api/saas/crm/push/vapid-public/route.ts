import { requireSaasRole } from "@/server/authz/gates";
import { getVapidPublic } from "@/server/crm/push";
import { handleError, ok } from "@/server/http/respond";

export async function GET() {
  try {
    const session = await requireSaasRole("admin", "vendedor");
    return ok(await getVapidPublic(session));
  } catch (err) {
    return handleError(err);
  }
}
