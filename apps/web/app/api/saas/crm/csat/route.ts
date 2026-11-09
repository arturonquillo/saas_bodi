import { requireSaasRole } from "@/server/authz/gates";
import { listCsat } from "@/server/crm/csat";
import { handleError, ok } from "@/server/http/respond";

export async function GET(req: Request) {
  try {
    const session = await requireSaasRole("admin");
    return ok(await listCsat(session, new URL(req.url)));
  } catch (err) {
    return handleError(err);
  }
}
