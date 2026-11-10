import { z } from "zod";
import { requireSaasRole } from "@/server/authz/gates";
import { adjustOnHand } from "@/server/inventory/service";
import { readJson } from "@/server/http/request";
import { fail, handleError, ok } from "@/server/http/respond";

const schema = z
  .object({
    delta_on_hand: z.number().int().optional(),
    motivo: z.string().min(1).optional(),
    // transitional aliases used by older clients
    delta: z.number().int().optional(),
    reason: z.string().min(1).optional(),
  })
  .refine((b) => (b.delta_on_hand ?? b.delta) !== undefined, { message: "delta_on_hand" })
  .refine((b) => (b.motivo ?? b.reason)?.trim(), { message: "motivo" });

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireSaasRole("admin");
    const { id } = await ctx.params;
    const parsed = schema.safeParse(await readJson(req));
    if (!parsed.success) return fail("validacao", "Ajuste inválido.");
    const delta = parsed.data.delta_on_hand ?? parsed.data.delta!;
    const motivo = (parsed.data.motivo ?? parsed.data.reason)!;
    return ok(await adjustOnHand(session, id, delta, motivo));
  } catch (err) {
    return handleError(err);
  }
}
