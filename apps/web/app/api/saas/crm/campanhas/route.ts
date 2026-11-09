import { z } from "zod";
import { requireSaasRole } from "@/server/authz/gates";
import { createCampanha, listCampanhas } from "@/server/crm/campaigns";
import { ApiError, handleError, ok } from "@/server/http/respond";

export async function GET(req: Request) {
  try {
    const session = await requireSaasRole("admin");
    return ok(await listCampanhas(session, new URL(req.url)));
  } catch (err) {
    return handleError(err);
  }
}

const createSchema = z.object({
  title: z.string(),
  kind: z.enum(["one_off", "ongoing"]),
  inbox_id: z.string().nullable().optional(),
  channel: z.enum(["whatsapp", "sms"]).optional(),
  audience_label_ids: z.array(z.string()).optional(),
  template_key: z.string().nullable().optional(),
  message: z.string().nullable().optional(),
  description: z.string().nullable().optional(),
  scheduled_at: z.string().nullable().optional(),
  display_status: z.string().nullable().optional(),
});

export async function POST(req: Request) {
  try {
    const session = await requireSaasRole("admin");
    const parsed = createSchema.safeParse(await req.json());
    if (!parsed.success) throw new ApiError("validacao", "Dados inválidos.");
    return ok(await createCampanha(session, parsed.data), 201);
  } catch (err) {
    return handleError(err);
  }
}
