import { z } from "zod";
import { requireSaasRole } from "@/server/authz/gates";
import { createPushSubscription } from "@/server/crm/push";
import { ApiError, handleError, ok } from "@/server/http/respond";

const schema = z.object({
  endpoint: z.string().min(1),
  keys: z.object({
    p256dh: z.string().min(1),
    auth: z.string().min(1),
  }),
});

export async function POST(req: Request) {
  try {
    const session = await requireSaasRole("admin", "vendedor");
    const parsed = schema.safeParse(await req.json());
    if (!parsed.success) throw new ApiError("validacao", "Dados inválidos.");
    return ok(await createPushSubscription(session, parsed.data), 201);
  } catch (err) {
    return handleError(err);
  }
}
