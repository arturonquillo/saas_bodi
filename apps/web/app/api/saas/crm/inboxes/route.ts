import { z } from "zod";
import { requireSaasRole } from "@/server/authz/gates";
import { createInbox, listInboxes } from "@/server/crm/inboxes";
import { ApiError, handleError, ok } from "@/server/http/respond";

export async function GET() {
  try {
    const session = await requireSaasRole("admin", "vendedor");
    return ok(await listInboxes(session));
  } catch (err) {
    return handleError(err);
  }
}

const createSchema = z.object({
  name: z.string().min(1),
  channel_type: z.literal("whatsapp").optional(),
});

export async function POST(req: Request) {
  try {
    const session = await requireSaasRole("admin");
    const parsed = createSchema.safeParse(await req.json());
    if (!parsed.success) throw new ApiError("validacao", "Dados inválidos.");
    return ok(await createInbox(session, parsed.data), 201);
  } catch (err) {
    return handleError(err);
  }
}

