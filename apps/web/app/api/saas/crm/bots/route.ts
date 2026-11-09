import { z } from "zod";
import { requireSaasRole } from "@/server/authz/gates";
import { createBot, listBots } from "@/server/crm/bots";
import { ApiError, handleError, ok } from "@/server/http/respond";

export async function GET() {
  try {
    const session = await requireSaasRole("admin");
    return ok(await listBots(session));
  } catch (err) {
    return handleError(err);
  }
}

const createSchema = z.object({
  name: z.string(),
  description: z.string().nullable().optional(),
  outgoing_url: z.string(),
  active: z.boolean().optional(),
});

export async function POST(req: Request) {
  try {
    const session = await requireSaasRole("admin");
    const parsed = createSchema.safeParse(await req.json());
    if (!parsed.success) throw new ApiError("validacao", "Dados inválidos.");
    return ok(await createBot(session, parsed.data), 201);
  } catch (err) {
    return handleError(err);
  }
}
