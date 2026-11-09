import { z } from "zod";
import { lojaWhatsappCta } from "@/server/inbox/service";
import { assertRateLimit } from "@/server/identity/rate-limit";
import { clientIp, publicTenantSlug, readJson } from "@/server/http/request";
import { fail, handleError, ok } from "@/server/http/respond";

const schema = z.object({
  phone_e164: z.string().optional(),
  body: z.string().optional(),
  intent_hint: z.enum(["cadastro", "orcamento", "info_empresa", "outro"]).optional(),
});

export async function POST(req: Request) {
  try {
    assertRateLimit(`wa-cta:${clientIp(req)}`, 15, 60_000);
    const parsed = schema.safeParse(await readJson(req).catch(() => ({})));
    if (!parsed.success) return fail("validacao", "Payload inválido.");
    return ok(
      await lojaWhatsappCta({
        ...parsed.data,
        tenantSlug: publicTenantSlug(req),
      }),
    );
  } catch (err) {
    return handleError(err);
  }
}
