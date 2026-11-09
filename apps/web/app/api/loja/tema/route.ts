import { getPublicTheme } from "@/server/theme/service";
import { publicTenantSlug } from "@/server/http/request";
import { handleError, ok } from "@/server/http/respond";

export async function GET(req: Request) {
  try {
    return ok(await getPublicTheme(publicTenantSlug(req)));
  } catch (err) {
    return handleError(err);
  }
}
