import { z } from "zod";
import { requireSaasRole } from "@/server/authz/gates";
import { createEmailTemplate, listEmailTemplates } from "@/server/crm/email-templates";
import { ApiError, handleError, ok } from "@/server/http/respond";

export async function GET() {
  try {
    const session = await requireSaasRole("admin");
    return ok(await listEmailTemplates(session));
  } catch (err) {
    return handleError(err);
  }
}

const createSchema = z.object({
  name: z.string().min(1),
  slug: z.string().optional(),
  subject_template: z.string().min(1),
  body_html_template: z.string().min(1),
});

export async function POST(req: Request) {
  try {
    const session = await requireSaasRole("admin");
    const parsed = createSchema.safeParse(await req.json());
    if (!parsed.success) throw new ApiError("validacao", "Dados inválidos.");
    return ok(await createEmailTemplate(session, parsed.data), 201);
  } catch (err) {
    return handleError(err);
  }
}
