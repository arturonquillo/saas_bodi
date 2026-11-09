import { getPublicArtigo } from "@/server/crm/help-center";
import { handleError, ok } from "@/server/http/respond";

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ portalSlug: string; articleSlug: string }> },
) {
  try {
    const { portalSlug, articleSlug } = await ctx.params;
    return ok(await getPublicArtigo(portalSlug, articleSlug));
  } catch (err) {
    return handleError(err);
  }
}
