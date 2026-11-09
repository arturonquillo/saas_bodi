import { z } from "zod";
import { requireSaasRole } from "@/server/authz/gates";
import { getIntegracao, putIntegracao } from "@/server/crm/integrations";
import { ApiError, handleError, ok } from "@/server/http/respond";

export async function GET(_req: Request, ctx: { params: Promise<{ provider: string }> }) {
  try {
    const session = await requireSaasRole("admin");
    const { provider } = await ctx.params;
    return ok(await getIntegracao(session, provider));
  } catch (err) {
    return handleError(err);
  }
}

const schema = z.object({
  connection_status: z
    .enum(["not_configured", "credentials_saved", "connected_stub", "live"])
    .optional(),
  metadata: z.record(z.string(), z.unknown()).nullable().optional(),
  secrets: z.record(z.string(), z.string()).optional(),
});

export async function PUT(req: Request, ctx: { params: Promise<{ provider: string }> }) {
  try {
    const session = await requireSaasRole("admin");
    const { provider } = await ctx.params;
    const parsed = schema.safeParse(await req.json());
    if (!parsed.success) throw new ApiError("validacao", "Dados inválidos.");
    return ok(await putIntegracao(session, provider, parsed.data));
  } catch (err) {
    return handleError(err);
  }
}
