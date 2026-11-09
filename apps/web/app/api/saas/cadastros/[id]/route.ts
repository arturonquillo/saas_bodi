import { requireSaasRole } from "@/server/authz/gates";
import { getCadastro } from "@/server/cadastro/service";
import { handleError, ok } from "@/server/http/respond";

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireSaasRole("admin", "vendedor");
    const { id } = await ctx.params;
    return ok(await getCadastro(session, id));
  } catch (err) {
    return handleError(err);
  }
}
