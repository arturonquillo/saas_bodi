import { z } from "zod";
import { submitPreChat } from "@/server/crm/widget";
import { ApiError, handleError, ok } from "@/server/http/respond";

const schema = z.object({
  fields: z.record(z.string()),
});

export async function POST(req: Request) {
  try {
    const parsed = schema.safeParse(await req.json());
    if (!parsed.success) throw new ApiError("validacao", "Dados inválidos.");
    return ok(await submitPreChat(req, parsed.data));
  } catch (err) {
    return handleError(err);
  }
}
