import { z } from "zod";
import { requireSaasRole } from "@/server/authz/gates";
import { simulateChannelInbound } from "@/server/crm/inboxes";
import { ApiError, handleError, ok } from "@/server/http/respond";

const schema = z.object({
  source_id: z.string().optional(),
  phone_e164: z.string().optional(),
  email: z.string().optional(),
  body: z.string().min(1),
  contact_nome: z.string().optional(),
});

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireSaasRole("admin");
    const { id } = await ctx.params;
    const parsed = schema.safeParse(await req.json());
    if (!parsed.success) throw new ApiError("validacao", "Dados inválidos.");
    return ok(await simulateChannelInbound(session, id, parsed.data), 201);
  } catch (err) {
    return handleError(err);
  }
}
