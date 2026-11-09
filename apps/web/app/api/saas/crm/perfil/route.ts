import { z } from "zod";
import { requireSaasRole } from "@/server/authz/gates";
import { getPerfil, patchPerfil } from "@/server/crm/meta";
import { ApiError, handleError, ok } from "@/server/http/respond";

const schema = z.object({
  availability: z.enum(["online", "busy", "offline"]).optional(),
  signature: z.string().nullable().optional(),
});

export async function GET() {
  try {
    const session = await requireSaasRole("admin", "vendedor");
    return ok(await getPerfil(session));
  } catch (err) {
    return handleError(err);
  }
}

export async function PATCH(req: Request) {
  try {
    const session = await requireSaasRole("admin", "vendedor");
    const parsed = schema.safeParse(await req.json());
    if (!parsed.success) throw new ApiError("validacao", "Dados inválidos.");
    return ok(await patchPerfil(session, parsed.data));
  } catch (err) {
    return handleError(err);
  }
}

