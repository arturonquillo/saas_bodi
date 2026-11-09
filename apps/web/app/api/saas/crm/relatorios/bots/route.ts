import { requirePermission } from "@/server/authz/gates";
import { reportBots } from "@/server/crm/reports";
import { handleError, ok } from "@/server/http/respond";

export async function GET(req: Request) {
  try {
    const session = await requirePermission("report_manage");
    return ok(await reportBots(session, new URL(req.url)));
  } catch (err) {
    return handleError(err);
  }
}
