import { z } from "zod";
import { requireSaasRole } from "@/server/authz/gates";
import { mesclarContatos } from "@/server/crm/merge-import";
import { ApiError, handleError, ok } from "@/server/http/respond";

const schema = z.object({
  survivor_id: z.string(),
  loser_id: z.string(),
});

export async function POST(req: Request) {
  try {
    const session = await requireSaasRole("admin", "vendedor");
    const parsed = schema.safeParse(await req.json());
    if (!parsed.success) throw new ApiError("validacao", "Dados inválidos.");
    return ok(await mesclarContatos(session, parsed.data));
  } catch (err) {
    return handleError(err);
  }
}
