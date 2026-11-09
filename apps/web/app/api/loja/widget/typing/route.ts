import { postWidgetTyping } from "@/server/crm/widget";
import { handleError, ok } from "@/server/http/respond";

export async function POST(req: Request) {
  try {
    return ok(await postWidgetTyping(req));
  } catch (err) {
    return handleError(err);
  }
}
