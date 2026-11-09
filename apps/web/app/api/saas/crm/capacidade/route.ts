import { z } from "zod";
import { requireSaasRole } from "@/server/authz/gates";
import { listCapacidade, putCapacidade } from "@/server/crm/capacity";
import { ApiError, handleError, ok } from "@/server/http/respond";

export async function GET() {
  try {
    const session = await requireSaasRole("admin");
    return ok(await listCapacidade(session));
  } catch (err) {
    return handleError(err);
  }
}

const putSchema = z.object({
  items: z.array(
    z.object({
      user_id: z.string().min(1),
      max_open_conversations: z.number().int().positive(),
    }),
  ),
});

export async function PUT(req: Request) {
  try {
    const session = await requireSaasRole("admin");
    const parsed = putSchema.safeParse(await req.json());
    if (!parsed.success) throw new ApiError("validacao", "Dados inválidos.");
    return ok(await putCapacidade(session, parsed.data));
  } catch (err) {
    return handleError(err);
  }
}
