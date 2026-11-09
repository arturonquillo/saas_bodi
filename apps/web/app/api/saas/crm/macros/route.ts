import { z } from "zod";
import { requireSaasRole } from "@/server/authz/gates";
import { createMacro, listMacros } from "@/server/crm/macros";
import { ApiError, handleError, ok } from "@/server/http/respond";

export async function GET() {
  try {
    const session = await requireSaasRole("admin", "vendedor");
    return ok(await listMacros(session));
  } catch (err) {
    return handleError(err);
  }
}

const createSchema = z.object({
  name: z.string(),
  actions: z.array(z.unknown()).optional(),
  visibility: z.enum(["public", "private"]).optional(),
});

export async function POST(req: Request) {
  try {
    const session = await requireSaasRole("admin", "vendedor");
    const parsed = createSchema.safeParse(await req.json());
    if (!parsed.success) throw new ApiError("validacao", "Dados inválidos.");
    return ok(
      await createMacro(session, {
        ...parsed.data,
        actions: parsed.data.actions as never,
      }),
      201,
    );
  } catch (err) {
    return handleError(err);
  }
}
