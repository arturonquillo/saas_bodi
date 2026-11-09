import { requirePermission } from "@/server/authz/gates";
import { listAudit } from "@/server/crm/audit";
import { handleError, ok } from "@/server/http/respond";

export async function GET(req: Request) {
  try {
    const session = await requirePermission("audit_read");
    return ok(await listAudit(session, new URL(req.url)));
  } catch (err) {
    return handleError(err);
  }
}
