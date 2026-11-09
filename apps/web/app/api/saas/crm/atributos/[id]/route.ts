import { z } from "zod";
import { requireSaasRole } from "@/server/authz/gates";
import { deleteAtributo, getAtributo, patchAtributo } from "@/server/crm/attributes";
import { ApiError, handleError, ok } from "@/server/http/respond";

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireSaasRole("admin", "vendedor");
    const { id } = await ctx.params;
    return ok(await getAtributo(session, id));
  } catch (err) {
    return handleError(err);
  }
}

const patchSchema = z.object({
  attribute_display_name: z.string().optional(),
  attribute_display_type: z
    .enum(["text", "number", "link", "date", "list", "checkbox"])
    .optional(),
  default_value: z.unknown().optional(),
  attribute_values: z.unknown().optional(),
});

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireSaasRole("admin");
    const { id } = await ctx.params;
    const parsed = patchSchema.safeParse(await req.json());
    if (!parsed.success) throw new ApiError("validacao", "Dados inválidos.");
    return ok(await patchAtributo(session, id, parsed.data));
  } catch (err) {
    return handleError(err);
  }
}

export async function DELETE(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireSaasRole("admin");
    const { id } = await ctx.params;
    return ok(await deleteAtributo(session, id));
  } catch (err) {
    return handleError(err);
  }
}
