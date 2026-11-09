import { z } from "zod";
import { requireSaasRole } from "@/server/authz/gates";
import { postPresence } from "@/server/crm/meta";
import { ApiError, handleError, ok } from "@/server/http/respond";

const schema = z.object({
  conversation_id: z.string().nullable().optional(),
  state: z.enum(["viewing", "typing", "online", "busy", "offline"]),
});

export async function POST(req: Request) {
  try {
    const session = await requireSaasRole("admin", "vendedor");
    const parsed = schema.safeParse(await req.json());
    if (!parsed.success) throw new ApiError("validacao", "Dados inválidos.");
    await postPresence(session, parsed.data);
    return new Response(null, { status: 204 });
  } catch (err) {
    return handleError(err);
  }
}

