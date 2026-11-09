import { getStoreCatalog } from "@/server/catalog/projection";
import { publicTenantSlug } from "@/server/http/request";
import { handleError, ok } from "@/server/http/respond";

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    return ok(await getStoreCatalog(publicTenantSlug(req), url));
  } catch (err) {
    return handleError(err);
  }
}
