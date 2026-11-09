import { z } from "zod";
import { requireSaasRole } from "@/server/authz/gates";
import { createPapel, listPapeis } from "@/server/crm/custom-roles";
import { ApiError, handleError, ok } from "@/server/http/respond";

export async function GET() {
  try {
    const session = await requireSaasRole("admin");
    return ok(await listPapeis(session));
  } catch (err) {
    return handleError(err);
  }
}

const schema = z.object({
  name: z.string().min(1),
  description: z.string().nullable().optional(),
  permissions: z.array(z.string()),
});

export async function POST(req: Request) {
  try {
    const session = await requireSaasRole("admin");
    const parsed = schema.safeParse(await req.json());
    if (!parsed.success) throw new ApiError("validacao", "Dados inválidos.");
    return ok(await createPapel(session, parsed.data));
  } catch (err) {
    return handleError(err);
  }
}
