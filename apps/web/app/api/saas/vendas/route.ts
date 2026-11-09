import { requireSaasRole } from "@/server/authz/gates";
import { listVendas } from "@/server/sales/venda";
import { handleError, ok } from "@/server/http/respond";

export async function GET(req: Request) {
  try {
    const session = await requireSaasRole("admin", "vendedor");
    return ok(await listVendas(session, new URL(req.url)));
  } catch (err) {
    return handleError(err);
  }
}
