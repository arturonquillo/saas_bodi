import { z } from "zod";
import { requireSaasRole } from "@/server/authz/gates";
import { createFiltro, listFiltros } from "@/server/crm/filters";
import { ApiError, handleError, ok } from "@/server/http/respond";

export async function GET() {
  try {
    const session = await requireSaasRole("admin", "vendedor");
    return ok(await listFiltros(session));
  } catch (err) {
    return handleError(err);
  }
}

const createSchema = z.object({
  name: z.string(),
  filter_type: z.enum(["conversation", "contact"]),
  query: z.record(z.unknown()).optional(),
});

export async function POST(req: Request) {
  try {
    const session = await requireSaasRole("admin", "vendedor");
    const parsed = createSchema.safeParse(await req.json());
    if (!parsed.success) throw new ApiError("validacao", "Dados inválidos.");
    return ok(await createFiltro(session, parsed.data), 201);
  } catch (err) {
    return handleError(err);
  }
}
