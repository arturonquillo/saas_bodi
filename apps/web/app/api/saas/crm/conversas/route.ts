import { requireSaasRole } from "@/server/authz/gates";
import { listConversas } from "@/server/crm/conversations";
import { handleError, ok } from "@/server/http/respond";

export async function GET(req: Request) {
  try {
    const session = await requireSaasRole("admin", "vendedor");
    return ok(await listConversas(session, new URL(req.url)));
  } catch (err) {
    return handleError(err);
  }
}

