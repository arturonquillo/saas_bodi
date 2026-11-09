import { z } from "zod";
import { requireSaasRole } from "@/server/authz/gates";
import { deleteArtigo, getArtigo, patchArtigo } from "@/server/crm/help-center";
import { ApiError, handleError, ok } from "@/server/http/respond";

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireSaasRole("admin");
    const { id } = await ctx.params;
    return ok(await getArtigo(session, id));
  } catch (err) {
    return handleError(err);
  }
}

const patchSchema = z.object({
  title: z.string().optional(),
  slug: z.string().optional(),
  category_id: z.string().optional(),
  content_md: z.string().optional(),
  status: z.enum(["draft", "published", "archived"]).optional(),
  position: z.number().int().optional(),
});

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireSaasRole("admin");
    const { id } = await ctx.params;
    const parsed = patchSchema.safeParse(await req.json());
    if (!parsed.success) throw new ApiError("validacao", "Dados inválidos.");
    return ok(await patchArtigo(session, id, parsed.data));
  } catch (err) {
    return handleError(err);
  }
}

export async function DELETE(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireSaasRole("admin");
    const { id } = await ctx.params;
    return ok(await deleteArtigo(session, id));
  } catch (err) {
    return handleError(err);
  }
}
