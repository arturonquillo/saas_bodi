import { requireSaasRole } from "@/server/authz/gates";
import { reportVisaoGeral } from "@/server/crm/reports";
import { handleError, ok } from "@/server/http/respond";

export async function GET(req: Request) {
  try {
    const session = await requireSaasRole("admin");
    return ok(await reportVisaoGeral(session, new URL(req.url)));
  } catch (err) {
    return handleError(err);
  }
}
