import { z } from "zod";
import { requireSaasRole } from "@/server/authz/gates";
import { deleteCampanha, getCampanha, patchCampanha } from "@/server/crm/campaigns";
import { ApiError, handleError, ok } from "@/server/http/respond";

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireSaasRole("admin");
    const { id } = await ctx.params;
    return ok(await getCampanha(session, id));
  } catch (err) {
    return handleError(err);
  }
}

const patchSchema = z.object({
  title: z.string().optional(),
  description: z.string().nullable().optional(),
  inbox_id: z.string().nullable().optional(),
  channel: z.enum(["whatsapp", "sms"]).optional(),
  audience_label_ids: z.array(z.string()).optional(),
  template_key: z.string().nullable().optional(),
  message: z.string().nullable().optional(),
  scheduled_at: z.string().nullable().optional(),
  display_status: z.string().nullable().optional(),
});

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireSaasRole("admin");
    const { id } = await ctx.params;
    const parsed = patchSchema.safeParse(await req.json());
    if (!parsed.success) throw new ApiError("validacao", "Dados inválidos.");
    return ok(await patchCampanha(session, id, parsed.data));
  } catch (err) {
    return handleError(err);
  }
}

export async function DELETE(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireSaasRole("admin");
    const { id } = await ctx.params;
    return ok(await deleteCampanha(session, id));
  } catch (err) {
    return handleError(err);
  }
}
