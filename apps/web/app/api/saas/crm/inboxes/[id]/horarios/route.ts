import { z } from "zod";
import { requireSaasRole } from "@/server/authz/gates";
import { getHorarios, putHorarios } from "@/server/crm/hours";
import { ApiError, handleError, ok } from "@/server/http/respond";

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireSaasRole("admin", "vendedor");
    const { id } = await ctx.params;
    return ok(await getHorarios(session, id));
  } catch (err) {
    return handleError(err);
  }
}

const hourSchema = z.object({
  day_of_week: z.number().int().min(0).max(6),
  closed_all_day: z.boolean().optional(),
  open_all_day: z.boolean().optional(),
  open_hour: z.number().int().nullable().optional(),
  open_minutes: z.number().int().nullable().optional(),
  close_hour: z.number().int().nullable().optional(),
  close_minutes: z.number().int().nullable().optional(),
});

const putSchema = z.object({
  timezone: z.string().optional(),
  hours: z.array(hourSchema),
});

export async function PUT(req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireSaasRole("admin");
    const { id } = await ctx.params;
    const parsed = putSchema.safeParse(await req.json());
    if (!parsed.success) throw new ApiError("validacao", "Dados inválidos.");
    return ok(await putHorarios(session, id, parsed.data));
  } catch (err) {
    return handleError(err);
  }
}
