import { requireSaasRole } from "@/server/authz/gates";
import { listCadastros } from "@/server/cadastro/service";
import { handleError, ok } from "@/server/http/respond";

export async function GET(req: Request) {
  try {
    const session = await requireSaasRole("admin", "vendedor");
    return ok(await listCadastros(session, new URL(req.url)));
  } catch (err) {
    return handleError(err);
  }
}
