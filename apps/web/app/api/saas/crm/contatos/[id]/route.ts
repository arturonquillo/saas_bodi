import { z } from "zod";
import { requireSaasRole } from "@/server/authz/gates";
import { getContato, patchContato } from "@/server/crm/contacts";
import { ApiError, handleError, ok } from "@/server/http/respond";

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireSaasRole("admin", "vendedor");
    const { id } = await ctx.params;
    return ok(await getContato(session, id));
  } catch (err) {
    return handleError(err);
  }
}

const patchSchema = z.object({
  nome: z.string().optional(),
  email: z.string().nullable().optional(),
  phone_e164: z.string().nullable().optional(),
  company_id: z.string().nullable().optional(),
  cliente_id: z.string().nullable().optional(),
  notas: z.string().nullable().optional(),
});

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireSaasRole("admin", "vendedor");
    const { id } = await ctx.params;
    const parsed = patchSchema.safeParse(await req.json());
    if (!parsed.success) throw new ApiError("validacao", "Dados inválidos.");
    return ok(await patchContato(session, id, parsed.data));
  } catch (err) {
    return handleError(err);
  }
}

