import { requireSaasRole } from "@/server/authz/gates";
import { rotacionarSegredoWebhook } from "@/server/crm/webhooks";
import { handleError, ok } from "@/server/http/respond";

export async function POST() {
  try {
    const session = await requireSaasRole("admin");
    return ok(await rotacionarSegredoWebhook(session));
  } catch (err) {
    return handleError(err);
  }
}
