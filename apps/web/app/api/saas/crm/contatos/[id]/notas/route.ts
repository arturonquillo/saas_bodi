import { z } from "zod";
import { requireSaasRole } from "@/server/authz/gates";
import { addContatoNota } from "@/server/crm/contacts";
import { ApiError, handleError, ok } from "@/server/http/respond";

const schema = z.object({ nota: z.string().min(1) });

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireSaasRole("admin", "vendedor");
    const { id } = await ctx.params;
    const parsed = schema.safeParse(await req.json());
    if (!parsed.success) throw new ApiError("validacao", "Dados inválidos.");
    return ok(await addContatoNota(session, id, parsed.data.nota));
  } catch (err) {
    return handleError(err);
  }
}

