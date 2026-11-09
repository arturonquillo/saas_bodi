import { z } from "zod";
import { requireSaasRole } from "@/server/authz/gates";
import { startContatoConversa } from "@/server/crm/contacts";
import { ApiError, handleError, ok } from "@/server/http/respond";

const schema = z.object({
  inbox_id: z.string().optional(),
  body: z.string().optional(),
});

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireSaasRole("admin", "vendedor");
    const { id } = await ctx.params;
    const parsed = schema.safeParse(await req.json().catch(() => ({})));
    if (!parsed.success) throw new ApiError("validacao", "Dados inválidos.");
    return ok(await startContatoConversa(session, id, parsed.data), 201);
  } catch (err) {
    return handleError(err);
  }
}

