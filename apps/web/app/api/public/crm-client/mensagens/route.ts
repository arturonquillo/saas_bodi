import { z } from "zod";
import { postCrmClientMessage } from "@/server/crm/crm-client";
import { ApiError, handleError, ok } from "@/server/http/respond";

const schema = z.object({
  source_id: z.string().min(1),
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

export async function POST(req: Request) {
  try {
    const parsed = schema.safeParse(await req.json());
    if (!parsed.success) throw new ApiError("validacao", "Dados inválidos.");
    return ok(await postCrmClientMessage(req, parsed.data), 201);
  } catch (err) {
    return handleError(err);
  }
}
