import { getLojaConfig } from "@/server/config/service";
import { publicTenantSlug } from "@/server/http/request";
import { handleError, ok } from "@/server/http/respond";

export async function GET(req: Request) {
  try {
    return ok(await getLojaConfig(publicTenantSlug(req)));
  } catch (err) {
    return handleError(err);
  }
}
