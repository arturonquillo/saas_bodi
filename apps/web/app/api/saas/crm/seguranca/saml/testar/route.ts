import { requireSaasRole } from "@/server/authz/gates";
import { testSaml } from "@/server/crm/security";
import { handleError, ok } from "@/server/http/respond";

export async function POST() {
  try {
    const session = await requireSaasRole("admin");
    return ok(await testSaml(session));
  } catch (err) {
    return handleError(err);
  }
}
