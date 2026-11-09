import { requireCustomer } from "@/server/authz/gates";
import { getMeCadastro } from "@/server/cadastro/service";
import { handleError, ok } from "@/server/http/respond";

export async function GET() {
  try {
    const session = await requireCustomer();
    return ok(await getMeCadastro(session));
  } catch (err) {
    return handleError(err);
  }
}
