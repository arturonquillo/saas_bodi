import { z } from "zod";
import { requireSaasRole } from "@/server/authz/gates";
import { simularInbound } from "@/server/crm/conversations";
import { ApiError, handleError, ok } from "@/server/http/respond";

const schema = z.object({
  inbox_id: z.string().optional(),
  phone_e164: z.string().min(1),
  body: z.string().min(1),
  intent_label: z
    .enum(["intent:cadastro", "intent:orcamento", "intent:info_empresa", "intent:outro"])
    .optional(),
});

export async function POST(req: Request) {
  try {
    const session = await requireSaasRole("admin");
    const parsed = schema.safeParse(await req.json());
    if (!parsed.success) throw new ApiError("validacao", "Dados inválidos.");
    return ok(await simularInbound(session, parsed.data), 201);
  } catch (err) {
    return handleError(err);
  }
}

