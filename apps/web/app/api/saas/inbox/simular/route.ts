import { z } from "zod";
import { requireSaasRole } from "@/server/authz/gates";
import { simulateInbound } from "@/server/inbox/service";
import { readJson } from "@/server/http/request";
import { fail, handleError, ok } from "@/server/http/respond";

const schema = z.object({
  phone_e164: z.string().min(8),
  body: z.string().min(1),
  intent_hint: z.enum(["cadastro", "orcamento", "info_empresa", "outro"]).optional(),
});

export async function POST(req: Request) {
  try {
    const session = await requireSaasRole("admin");
    const parsed = schema.safeParse(await readJson(req));
    if (!parsed.success) return fail("validacao", "Simulação inválida.");
    return ok(await simulateInbound(session, parsed.data), 201);
  } catch (err) {
    return handleError(err);
  }
}
