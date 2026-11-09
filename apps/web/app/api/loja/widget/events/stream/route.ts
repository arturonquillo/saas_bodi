import { createWidgetSseStream } from "@/server/crm/widget";
import { handleError } from "@/server/http/respond";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    const stream = createWidgetSseStream(req);
    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache, no-transform",
        Connection: "keep-alive",
      },
    });
  } catch (err) {
    return handleError(err);
  }
}
