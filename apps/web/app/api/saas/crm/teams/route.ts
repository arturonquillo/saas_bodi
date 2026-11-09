import { z } from "zod";
import { requireSaasRole } from "@/server/authz/gates";
import { createTeam, listTeams } from "@/server/crm/meta";
import { ApiError, handleError, ok } from "@/server/http/respond";

export async function GET() {
  try {
    const session = await requireSaasRole("admin", "vendedor");
    return ok(await listTeams(session));
  } catch (err) {
    return handleError(err);
  }
}

const postSchema = z.object({ name: z.string().min(1) });

export async function POST(req: Request) {
  try {
    const session = await requireSaasRole("admin");
    const parsed = postSchema.safeParse(await req.json());
    if (!parsed.success) throw new ApiError("validacao", "Dados inválidos.");
    return ok(await createTeam(session, parsed.data.name), 201);
  } catch (err) {
    return handleError(err);
  }
}

