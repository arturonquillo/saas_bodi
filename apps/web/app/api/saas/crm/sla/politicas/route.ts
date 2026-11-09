import { z } from "zod";
import { requireSaasRole } from "@/server/authz/gates";
import { createSlaPolicy, listSlaPolicies } from "@/server/crm/sla";
import { ApiError, handleError, ok } from "@/server/http/respond";

export async function GET() {
  try {
    const session = await requireSaasRole("admin");
    return ok(await listSlaPolicies(session));
  } catch (err) {
    return handleError(err);
  }
}

const createSchema = z.object({
  name: z.string().min(1),
  frt_seconds: z.number().int().positive(),
  nrt_seconds: z.number().int().positive(),
  rt_seconds: z.number().int().positive(),
  active: z.boolean().optional(),
  description: z.string().nullable().optional(),
});

export async function POST(req: Request) {
  try {
    const session = await requireSaasRole("admin");
    const parsed = createSchema.safeParse(await req.json());
    if (!parsed.success) throw new ApiError("validacao", "Dados inválidos.");
    return ok(await createSlaPolicy(session, parsed.data));
  } catch (err) {
    return handleError(err);
  }
}
