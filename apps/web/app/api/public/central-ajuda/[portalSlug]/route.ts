import {
  getPublicPortal,
} from "@/server/crm/help-center";
import { handleError, ok } from "@/server/http/respond";

export async function GET(_req: Request, ctx: { params: Promise<{ portalSlug: string }> }) {
  try {
    const { portalSlug } = await ctx.params;
    return ok(await getPublicPortal(portalSlug));
  } catch (err) {
    return handleError(err);
  }
}
