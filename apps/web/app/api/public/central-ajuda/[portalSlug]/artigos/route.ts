import { listPublicArtigos } from "@/server/crm/help-center";
import { handleError, ok } from "@/server/http/respond";

export async function GET(req: Request, ctx: { params: Promise<{ portalSlug: string }> }) {
  try {
    const { portalSlug } = await ctx.params;
    return ok(await listPublicArtigos(portalSlug, new URL(req.url)));
  } catch (err) {
    return handleError(err);
  }
}
