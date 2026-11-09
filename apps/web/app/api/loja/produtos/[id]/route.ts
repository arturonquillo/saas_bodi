import { getStoreProduct } from "@/server/catalog/projection";
import { publicTenantSlug } from "@/server/http/request";
import { handleError, ok } from "@/server/http/respond";

export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params;
    return ok(await getStoreProduct(id, publicTenantSlug(req)));
  } catch (err) {
    return handleError(err);
  }
}
