import { requireSaasRole } from "@/server/authz/gates";
import { listNotificacoes } from "@/server/crm/meta";
import { handleError, ok } from "@/server/http/respond";

export async function GET(req: Request) {
  try {
    const session = await requireSaasRole("admin", "vendedor");
    return ok(await listNotificacoes(session, new URL(req.url)));
  } catch (err) {
    return handleError(err);
  }
}

