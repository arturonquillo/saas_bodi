import { requireSaasRole } from "@/server/authz/gates";
import { listInbox } from "@/server/inbox/service";
import { handleError, ok } from "@/server/http/respond";

export async function GET(req: Request) {
  try {
    const session = await requireSaasRole("admin", "vendedor");
    return ok(await listInbox(session, new URL(req.url)));
  } catch (err) {
    return handleError(err);
  }
}
