import { z } from "zod";
import { requireSaasRole } from "@/server/authz/gates";
import { listMensagens, postMensagem } from "@/server/crm/conversations";
import { ApiError, handleError, ok } from "@/server/http/respond";

export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireSaasRole("admin", "vendedor");
    const { id } = await ctx.params;
    return ok(await listMensagens(session, id, new URL(req.url)));
  } catch (err) {
    return handleError(err);
  }
}

const postSchema = z.object({
  content: z.string().min(1),
  private: z.boolean().optional(),
  content_type: z.enum(["text", "attachment", "input_select", "cards", "form"]).optional(),
});

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireSaasRole("admin", "vendedor");
    const { id } = await ctx.params;
    const parsed = postSchema.safeParse(await req.json());
    if (!parsed.success) throw new ApiError("validacao", "Dados inválidos.");
    return ok(await postMensagem(session, id, parsed.data), 201);
  } catch (err) {
    return handleError(err);
  }
}

