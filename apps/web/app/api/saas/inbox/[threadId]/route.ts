import { z } from "zod";
import { requireSaasRole } from "@/server/authz/gates";
import { getInboxThread, patchInboxThread } from "@/server/inbox/service";
import { readJson } from "@/server/http/request";
import { fail, handleError, ok } from "@/server/http/respond";

const schema = z.object({
  intent: z.enum(["cadastro", "orcamento", "info_empresa", "outro"]).nullable().optional(),
  status: z.enum(["aberta", "arquivada"]).optional(),
  cliente_id: z.string().nullable().optional(),
  cadastro_request_id: z.string().nullable().optional(),
  orcamento_id: z.string().nullable().optional(),
});

export async function GET(_req: Request, ctx: { params: Promise<{ threadId: string }> }) {
  try {
    const session = await requireSaasRole("admin", "vendedor");
    const { threadId } = await ctx.params;
    return ok(await getInboxThread(session, threadId));
  } catch (err) {
    return handleError(err);
  }
}

export async function PATCH(req: Request, ctx: { params: Promise<{ threadId: string }> }) {
  try {
    const session = await requireSaasRole("admin", "vendedor");
    const { threadId } = await ctx.params;
    const parsed = schema.safeParse(await readJson(req));
    if (!parsed.success) return fail("validacao", "Dados inválidos.");
    return ok(await patchInboxThread(session, threadId, parsed.data));
  } catch (err) {
    return handleError(err);
  }
}
