import { requireSaasRole } from "@/server/authz/gates";
import { getChannel, putChannel } from "@/server/crm/inboxes";
import { ApiError, handleError, ok } from "@/server/http/respond";

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireSaasRole("admin", "vendedor");
    const { id } = await ctx.params;
    return ok(await getChannel(session, id));
  } catch (err) {
    return handleError(err);
  }
}

export async function PUT(req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireSaasRole("admin");
    const { id } = await ctx.params;
    const body = (await req.json()) as Record<string, unknown>;
    if (!body || typeof body !== "object") throw new ApiError("validacao", "Dados inválidos.");
    return ok(await putChannel(session, id, body));
  } catch (err) {
    return handleError(err);
  }
}
