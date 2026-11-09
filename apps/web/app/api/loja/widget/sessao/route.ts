import { z } from "zod";
import { createWidgetSession, widgetSessionCookie } from "@/server/crm/widget";
import { ApiError, handleError, ok } from "@/server/http/respond";

const schema = z.object({
  website_token: z.string().min(1),
});

export async function POST(req: Request) {
  try {
    const parsed = schema.safeParse(await req.json());
    if (!parsed.success) throw new ApiError("validacao", "Dados inválidos.");
    const result = await createWidgetSession({
      websiteToken: parsed.data.website_token,
      origin: req.headers.get("origin"),
    });
    const res = ok(result, 201);
    res.headers.set("Set-Cookie", widgetSessionCookie(result.session_token));
    return res;
  } catch (err) {
    return handleError(err);
  }
}
