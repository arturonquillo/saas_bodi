import { z } from "zod";
import { assertRateLimit } from "@/server/identity/rate-limit";
import { lookupCnpj } from "@/server/identity/cnpj-lookup";
import { clientIp, readJson } from "@/server/http/request";
import { fail, handleError, ok } from "@/server/http/respond";

const schema = z.object({ cnpj: z.string().min(14) });

export async function POST(req: Request) {
  try {
    assertRateLimit(`cnpj:${clientIp(req)}`);
    const parsed = schema.safeParse(await readJson(req));
    if (!parsed.success) return fail("validacao", "Informe o CNPJ.");
    return ok(await lookupCnpj(parsed.data.cnpj));
  } catch (err) {
    return handleError(err);
  }
}
