import { z } from "zod";
import { requireSaasRole } from "@/server/authz/gates";
import { getChannel, putChannel } from "@/server/crm/inboxes";
import { ApiError, handleError, ok } from "@/server/http/respond";

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireSaasRole("admin");
    const { id } = await ctx.params;
    return ok(await getChannel(session, id));
  } catch (err) {
    return handleError(err);
  }
}

const putSchema = z.object({
  phone_e164_display: z.string().nullable().optional(),
  phone_number_id: z.string().nullable().optional(),
  business_account_id: z.string().nullable().optional(),
  api_token: z.string().optional(),
  api_secret: z.string().optional(),
  webhook_verify_token: z.string().optional(),
  connection_status: z.enum(["not_configured", "credentials_saved", "ready_stub", "live"]).optional(),
  provider: z.enum(["whatsapp_cloud", "default"]).optional(),
});

export async function PUT(req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireSaasRole("admin");
    const { id } = await ctx.params;
    const parsed = putSchema.safeParse(await req.json());
    if (!parsed.success) throw new ApiError("validacao", "Dados inválidos.");
    return ok(await putChannel(session, id, parsed.data));
  } catch (err) {
    return handleError(err);
  }
}

