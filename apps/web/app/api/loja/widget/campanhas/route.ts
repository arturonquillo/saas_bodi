import { listWidgetCampaigns } from "@/server/crm/widget";
import { handleError, ok } from "@/server/http/respond";

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    return ok(await listWidgetCampaigns(req, url.searchParams.get("website_token")));
  } catch (err) {
    return handleError(err);
  }
}
