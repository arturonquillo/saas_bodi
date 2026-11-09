import { z } from "zod";
import { requireSaasRole } from "@/server/authz/gates";
import { createArtigo, listArtigos } from "@/server/crm/help-center";
import { ApiError, handleError, ok } from "@/server/http/respond";

export async function GET(req: Request) {
  try {
    const session = await requireSaasRole("admin");
    return ok(await listArtigos(session, new URL(req.url)));
  } catch (err) {
    return handleError(err);
  }
}

const createSchema = z.object({
  title: z.string(),
  slug: z.string().optional(),
  category_id: z.string(),
  content_md: z.string(),
  status: z.enum(["draft", "published", "archived"]).optional(),
  position: z.number().int().optional(),
});

export async function POST(req: Request) {
  try {
    const session = await requireSaasRole("admin");
    const parsed = createSchema.safeParse(await req.json());
    if (!parsed.success) throw new ApiError("validacao", "Dados inválidos.");
    return ok(await createArtigo(session, parsed.data), 201);
  } catch (err) {
    return handleError(err);
  }
}
