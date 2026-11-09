import { z } from "zod";
import { requireSaasRole } from "@/server/authz/gates";
import { createWebhook, listWebhooks } from "@/server/crm/webhooks";
import { ApiError, handleError, ok } from "@/server/http/respond";

export async function GET() {
  try {
    const session = await requireSaasRole("admin");
    return ok(await listWebhooks(session));
  } catch (err) {
    return handleError(err);
  }
}

const createSchema = z.object({
  url: z.string(),
  name: z.string().nullable().optional(),
  subscriptions: z.array(z.string()).optional(),
  inbox_id: z.string().nullable().optional(),
  active: z.boolean().optional(),
});

export async function POST(req: Request) {
  try {
    const session = await requireSaasRole("admin");
    const parsed = createSchema.safeParse(await req.json());
    if (!parsed.success) throw new ApiError("validacao", "Dados inválidos.");
    return ok(await createWebhook(session, parsed.data), 201);
  } catch (err) {
    return handleError(err);
  }
}
