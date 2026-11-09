import { bootstrapWidget } from "@/server/crm/widget";
import { ApiError, handleError, ok } from "@/server/http/respond";

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const websiteToken = url.searchParams.get("website_token");
    if (!websiteToken) throw new ApiError("validacao", "website_token obrigatório.");
    return ok(
      await bootstrapWidget({
        websiteToken,
        origin: req.headers.get("origin"),
      }),
    );
  } catch (err) {
    return handleError(err);
  }
}
