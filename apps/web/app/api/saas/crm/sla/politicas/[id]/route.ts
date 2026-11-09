import { z } from "zod";
import { requireSaasRole } from "@/server/authz/gates";
import { deleteSlaPolicy, getSlaPolicy, patchSlaPolicy } from "@/server/crm/sla";
import { ApiError, handleError, ok } from "@/server/http/respond";

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireSaasRole("admin");
    const { id } = await ctx.params;
    return ok(await getSlaPolicy(session, id));
  } catch (err) {
    return handleError(err);
  }
}

const patchSchema = z.object({
  name: z.string().min(1).optional(),
  frt_seconds: z.number().int().positive().optional(),
  nrt_seconds: z.number().int().positive().optional(),
  rt_seconds: z.number().int().positive().optional(),
  active: z.boolean().optional(),
  description: z.string().nullable().optional(),
});

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireSaasRole("admin");
    const { id } = await ctx.params;
    const parsed = patchSchema.safeParse(await req.json());
    if (!parsed.success) throw new ApiError("validacao", "Dados inválidos.");
    return ok(await patchSlaPolicy(session, id, parsed.data));
  } catch (err) {
    return handleError(err);
  }
}

export async function DELETE(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireSaasRole("admin");
    const { id } = await ctx.params;
    return ok(await deleteSlaPolicy(session, id));
  } catch (err) {
    return handleError(err);
  }
}
