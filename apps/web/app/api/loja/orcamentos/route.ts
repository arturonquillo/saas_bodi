import { requireCustomer } from "@/server/authz/gates";
import { listLojaOrcamentos } from "@/server/sales/orcamento";
import { handleError, ok } from "@/server/http/respond";

export async function GET(req: Request) {
  try {
    const session = await requireCustomer();
    return ok(await listLojaOrcamentos(session, new URL(req.url)));
  } catch (err) {
    return handleError(err);
  }
}
