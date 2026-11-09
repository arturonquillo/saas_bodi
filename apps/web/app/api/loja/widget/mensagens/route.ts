import { z } from "zod";
import { listWidgetMessages, postWidgetMessage } from "@/server/crm/widget";
import { ApiError, handleError, ok } from "@/server/http/respond";

export async function GET(req: Request) {
  try {
    return ok(await listWidgetMessages(req, new URL(req.url)));
  } catch (err) {
    return handleError(err);
  }
}

const postSchema = z.object({
  content: z.string().min(1),
  content_type: z.enum(["text", "attachment", "input_select", "cards", "form"]).optional(),
});

export async function POST(req: Request) {
  try {
    const parsed = postSchema.safeParse(await req.json());
    if (!parsed.success) throw new ApiError("validacao", "Dados inválidos.");
    return ok(await postWidgetMessage(req, parsed.data), 201);
  } catch (err) {
    return handleError(err);
  }
}
