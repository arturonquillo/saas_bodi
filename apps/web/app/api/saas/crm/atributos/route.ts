import { z } from "zod";
import { requireSaasRole } from "@/server/authz/gates";
import { createAtributo, listAtributos } from "@/server/crm/attributes";
import { ApiError, handleError, ok } from "@/server/http/respond";

export async function GET(req: Request) {
  try {
    const session = await requireSaasRole("admin", "vendedor");
    const url = new URL(req.url);
    return ok(await listAtributos(session, url.searchParams.get("model")));
  } catch (err) {
    return handleError(err);
  }
}

const createSchema = z.object({
  attribute_model: z.enum(["contact", "conversation"]),
  attribute_display_type: z.enum(["text", "number", "link", "date", "list", "checkbox"]),
  attribute_key: z.string(),
  attribute_display_name: z.string(),
  default_value: z.unknown().optional(),
  attribute_values: z.unknown().optional(),
});

export async function POST(req: Request) {
  try {
    const session = await requireSaasRole("admin");
    const parsed = createSchema.safeParse(await req.json());
    if (!parsed.success) throw new ApiError("validacao", "Dados inválidos.");
    return ok(await createAtributo(session, parsed.data), 201);
  } catch (err) {
    return handleError(err);
  }
}
