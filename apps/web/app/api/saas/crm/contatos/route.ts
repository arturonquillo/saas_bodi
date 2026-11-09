import { z } from "zod";
import { requireSaasRole } from "@/server/authz/gates";
import { createContato, listContatos } from "@/server/crm/contacts";
import { ApiError, handleError, ok } from "@/server/http/respond";

export async function GET(req: Request) {
  try {
    const session = await requireSaasRole("admin", "vendedor");
    return ok(await listContatos(session, new URL(req.url)));
  } catch (err) {
    return handleError(err);
  }
}

const postSchema = z.object({
  nome: z.string().min(1),
  email: z.string().nullable().optional(),
  phone_e164: z.string().nullable().optional(),
  company_id: z.string().nullable().optional(),
  notas: z.string().nullable().optional(),
});

export async function POST(req: Request) {
  try {
    const session = await requireSaasRole("admin", "vendedor");
    const parsed = postSchema.safeParse(await req.json());
    if (!parsed.success) throw new ApiError("validacao", "Dados inválidos.");
    return ok(await createContato(session, parsed.data), 201);
  } catch (err) {
    return handleError(err);
  }
}

