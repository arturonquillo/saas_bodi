import { getWidgetConversation } from "@/server/crm/widget";
import { handleError, ok } from "@/server/http/respond";

export async function GET(req: Request) {
  try {
    return ok(await getWidgetConversation(req));
  } catch (err) {
    return handleError(err);
  }
}
