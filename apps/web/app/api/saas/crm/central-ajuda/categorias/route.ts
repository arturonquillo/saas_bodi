import { z } from "zod";
import { requireSaasRole } from "@/server/authz/gates";
import { createCategoria, listCategorias } from "@/server/crm/help-center";
import { ApiError, handleError, ok } from "@/server/http/respond";

export async function GET() {
  try {
    const session = await requireSaasRole("admin");
    return ok(await listCategorias(session));
  } catch (err) {
    return handleError(err);
  }
}

const createSchema = z.object({
  name: z.string(),
  slug: z.string().optional(),
  description: z.string().nullable().optional(),
  position: z.number().int().optional(),
  parent_category_id: z.string().nullable().optional(),
});

export async function POST(req: Request) {
  try {
    const session = await requireSaasRole("admin");
    const parsed = createSchema.safeParse(await req.json());
    if (!parsed.success) throw new ApiError("validacao", "Dados inválidos.");
    return ok(await createCategoria(session, parsed.data), 201);
  } catch (err) {
    return handleError(err);
  }
}
