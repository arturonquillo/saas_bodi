import { requireSaasRole } from "@/server/authz/gates";
import { listAvisos } from "@/server/avisos/service";
import { handleError, ok } from "@/server/http/respond";

export async function GET(req: Request) {
  try {
    const session = await requireSaasRole("admin", "vendedor");
    return ok(await listAvisos(session, new URL(req.url)));
  } catch (err) {
    return handleError(err);
  }
}
