import { z } from "zod";
import { requireSaasRole } from "@/server/authz/gates";
import { createUsuario, listUsuarios } from "@/server/users/service";
import { readJson } from "@/server/http/request";
import { fail, handleError, ok } from "@/server/http/respond";

const createSchema = z.object({
  email: z.string().email(),
  nome: z.string().min(1),
  senha: z.string().min(8),
  saas_role: z.enum(["admin", "vendedor"]),
  whatsapp: z.string().optional(),
});

export async function GET(req: Request) {
  try {
    const session = await requireSaasRole("admin");
    return ok(await listUsuarios(session, new URL(req.url)));
  } catch (err) {
    return handleError(err);
  }
}

export async function POST(req: Request) {
  try {
    const session = await requireSaasRole("admin");
    const parsed = createSchema.safeParse(await readJson(req));
    if (!parsed.success) return fail("validacao", "Dados do usuário inválidos.");
    return ok(await createUsuario(session, parsed.data), 201);
  } catch (err) {
    return handleError(err);
  }
}
