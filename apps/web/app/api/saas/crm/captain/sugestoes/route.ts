import { requireSaasRole } from "@/server/authz/gates";
import { listSugestoes } from "@/server/crm/captain";
import { handleError, ok } from "@/server/http/respond";

export async function GET(req: Request) {
  try {
    const session = await requireSaasRole("admin", "vendedor");
    return ok(await listSugestoes(session, new URL(req.url)));
  } catch (err) {
    return handleError(err);
  }
}
