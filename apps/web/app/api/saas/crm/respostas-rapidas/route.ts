import { z } from "zod";
import { requireSaasRole } from "@/server/authz/gates";
import { createCanned, listCanned } from "@/server/crm/meta";
import { ApiError, handleError, ok } from "@/server/http/respond";

export async function GET() {
  try {
    const session = await requireSaasRole("admin", "vendedor");
    return ok(await listCanned(session));
  } catch (err) {
    return handleError(err);
  }
}

const postSchema = z.object({
  short_code: z.string().min(1),
  content: z.string().min(1),
});

export async function POST(req: Request) {
  try {
    const session = await requireSaasRole("admin", "vendedor");
    const parsed = postSchema.safeParse(await req.json());
    if (!parsed.success) throw new ApiError("validacao", "Dados inválidos.");
    return ok(await createCanned(session, parsed.data), 201);
  } catch (err) {
    return handleError(err);
  }
}

