import { requireSaasRole } from "@/server/authz/gates";
import { previewImportCsv } from "@/server/crm/merge-import";
import { ApiError, handleError, ok } from "@/server/http/respond";

export async function POST(req: Request) {
  try {
    const session = await requireSaasRole("admin", "vendedor");
    const contentType = req.headers.get("content-type") || "";
    let csvText = "";
    if (contentType.includes("application/json")) {
      const body = (await req.json()) as { csv?: string };
      csvText = body.csv ?? "";
    } else {
      csvText = await req.text();
    }
    if (!csvText.trim()) throw new ApiError("validacao", "CSV obrigatório.");
    return ok(await previewImportCsv(session, csvText));
  } catch (err) {
    return handleError(err);
  }
}
