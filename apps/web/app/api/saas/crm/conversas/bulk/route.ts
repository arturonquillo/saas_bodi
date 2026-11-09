import { z } from "zod";
import { requireSaasRole } from "@/server/authz/gates";
import { bulkConversas } from "@/server/crm/conversations";
import { ApiError, handleError, ok } from "@/server/http/respond";

const schema = z.object({
  ids: z.array(z.string()).min(1),
  action: z.enum(["assign", "resolve", "label", "mute"]),
  params: z
    .object({
      assignee_user_id: z.string().nullable().optional(),
      label_ids: z.array(z.string()).optional(),
      muted: z.boolean().optional(),
    })
    .optional(),
});

export async function POST(req: Request) {
  try {
    const session = await requireSaasRole("admin", "vendedor");
    const parsed = schema.safeParse(await req.json());
    if (!parsed.success) throw new ApiError("validacao", "Dados inválidos.");
    return ok(await bulkConversas(session, parsed.data));
  } catch (err) {
    return handleError(err);
  }
}

