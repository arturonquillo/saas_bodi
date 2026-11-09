import { z } from "zod";
import { getSaasTheme, putSaasTheme } from "@/server/theme/service";
import { requireSaasRole } from "@/server/authz/gates";
import { readJson } from "@/server/http/request";
import { fail, handleError, ok } from "@/server/http/respond";

const schema = z.object({
  marca: z.string().min(1),
  primary: z.string().regex(/^#[0-9A-Fa-f]{6}$/),
  accent: z.string().regex(/^#[0-9A-Fa-f]{6}$/),
  background: z.string().regex(/^#[0-9A-Fa-f]{6}$/),
  logo_url: z.string().nullable(),
});

export async function GET() {
  try {
    const session = await requireSaasRole("admin");
    return ok(await getSaasTheme(session));
  } catch (err) {
    return handleError(err);
  }
}

export async function PUT(req: Request) {
  try {
    const session = await requireSaasRole("admin");
    const parsed = schema.safeParse(await readJson(req));
    if (!parsed.success) return fail("validacao", "Tema inválido.");
    return ok(await putSaasTheme(session, parsed.data));
  } catch (err) {
    return handleError(err);
  }
}
