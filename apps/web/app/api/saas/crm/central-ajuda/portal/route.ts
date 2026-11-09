import { z } from "zod";
import { requireSaasRole } from "@/server/authz/gates";
import { getPortal, putPortal } from "@/server/crm/help-center";
import { ApiError, handleError, ok } from "@/server/http/respond";

export async function GET() {
  try {
    const session = await requireSaasRole("admin");
    return ok(await getPortal(session));
  } catch (err) {
    return handleError(err);
  }
}

const putSchema = z.object({
  name: z.string(),
  slug: z.string(),
  header_text: z.string().nullable().optional(),
  homepage_md: z.string().nullable().optional(),
  enabled: z.boolean().optional(),
});

export async function PUT(req: Request) {
  try {
    const session = await requireSaasRole("admin");
    const parsed = putSchema.safeParse(await req.json());
    if (!parsed.success) throw new ApiError("validacao", "Dados inválidos.");
    return ok(await putPortal(session, parsed.data));
  } catch (err) {
    return handleError(err);
  }
}
