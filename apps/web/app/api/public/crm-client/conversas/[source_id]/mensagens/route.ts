import { z } from "zod";
import {
  listCrmClientMessages,
  postCrmClientConversationMessage,
} from "@/server/crm/crm-client";
import { ApiError, handleError, ok } from "@/server/http/respond";

export async function GET(req: Request, ctx: { params: Promise<{ source_id: string }> }) {
  try {
    const { source_id } = await ctx.params;
    return ok(await listCrmClientMessages(req, source_id, new URL(req.url)));
  } catch (err) {
    return handleError(err);
  }
}

const schema = z.object({
  content: z.string().min(1),
  content_type: z.enum(["text", "attachment", "input_select", "cards", "form"]).optional(),
  contact: z
    .object({
      nome: z.string().optional(),
      email: z.string().optional(),
      phone_e164: z.string().optional(),
    })
    .optional(),
});

export async function POST(req: Request, ctx: { params: Promise<{ source_id: string }> }) {
  try {
    const { source_id } = await ctx.params;
    const parsed = schema.safeParse(await req.json());
    if (!parsed.success) throw new ApiError("validacao", "Dados inválidos.");
    return ok(await postCrmClientConversationMessage(req, source_id, parsed.data), 201);
  } catch (err) {
    return handleError(err);
  }
}
