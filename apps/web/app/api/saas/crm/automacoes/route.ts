import { z } from "zod";
import { requireSaasRole } from "@/server/authz/gates";
import { createAutomacao, listAutomacoes } from "@/server/crm/automations";
import { ApiError, handleError, ok } from "@/server/http/respond";

export async function GET() {
  try {
    const session = await requireSaasRole("admin");
    return ok(await listAutomacoes(session));
  } catch (err) {
    return handleError(err);
  }
}

const createSchema = z.object({
  name: z.string(),
  description: z.string().nullable().optional(),
  event_name: z.string(),
  conditions: z.unknown().optional(),
  actions: z.array(z.unknown()).optional(),
  active: z.boolean().optional(),
});

export async function POST(req: Request) {
  try {
    const session = await requireSaasRole("admin");
    const parsed = createSchema.safeParse(await req.json());
    if (!parsed.success) throw new ApiError("validacao", "Dados inválidos.");
    return ok(
      await createAutomacao(session, {
        ...parsed.data,
        conditions: parsed.data.conditions as never,
        actions: parsed.data.actions as never,
      }),
      201,
    );
  } catch (err) {
    return handleError(err);
  }
}
