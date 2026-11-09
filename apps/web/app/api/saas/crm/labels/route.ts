import { z } from "zod";
import { requireSaasRole } from "@/server/authz/gates";
import { createLabel, listLabels } from "@/server/crm/meta";
import { ApiError, handleError, ok } from "@/server/http/respond";

export async function GET() {
  try {
    const session = await requireSaasRole("admin", "vendedor");
    return ok(await listLabels(session));
  } catch (err) {
    return handleError(err);
  }
}

const postSchema = z.object({
  title: z.string().min(1),
  color: z.string().optional(),
  show_on_sidebar: z.boolean().optional(),
});

export async function POST(req: Request) {
  try {
    const session = await requireSaasRole("admin", "vendedor");
    const parsed = postSchema.safeParse(await req.json());
    if (!parsed.success) throw new ApiError("validacao", "Dados inválidos.");
    return ok(await createLabel(session, parsed.data), 201);
  } catch (err) {
    return handleError(err);
  }
}

