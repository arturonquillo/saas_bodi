import { z } from "zod";
import { requireSaasRole } from "@/server/authz/gates";
import { createAppPainel, listAppsPainel } from "@/server/crm/dashboard-apps";
import { ApiError, handleError, ok } from "@/server/http/respond";

export async function GET() {
  try {
    const session = await requireSaasRole("admin");
    return ok(await listAppsPainel(session));
  } catch (err) {
    return handleError(err);
  }
}

const schema = z.object({
  title: z.string().min(1),
  url: z.string().min(1),
  enabled: z.boolean().optional(),
  inbox_ids: z.array(z.string()).nullable().optional(),
  position: z.number().int().optional(),
});

export async function POST(req: Request) {
  try {
    const session = await requireSaasRole("admin");
    const parsed = schema.safeParse(await req.json());
    if (!parsed.success) throw new ApiError("validacao", "Dados inválidos.");
    return ok(await createAppPainel(session, parsed.data));
  } catch (err) {
    return handleError(err);
  }
}
