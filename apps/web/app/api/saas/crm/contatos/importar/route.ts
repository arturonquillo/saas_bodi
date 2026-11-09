import { requireSaasRole } from "@/server/authz/gates";
import { importarContatosCsv } from "@/server/crm/merge-import";
import { ApiError, handleError, ok } from "@/server/http/respond";

export async function POST(req: Request) {
  try {
    const session = await requireSaasRole("admin", "vendedor");
    const contentType = req.headers.get("content-type") || "";
    let csvText = "";
    if (contentType.includes("multipart/form-data")) {
      const form = await req.formData();
      const file = form.get("file");
      if (file && typeof file === "object" && "text" in file) {
        csvText = await (file as File).text();
      } else if (typeof form.get("csv") === "string") {
        csvText = String(form.get("csv"));
      }
    } else if (contentType.includes("application/json")) {
      const body = (await req.json()) as { csv?: string };
      csvText = body.csv ?? "";
    } else {
      csvText = await req.text();
    }
    if (!csvText.trim()) throw new ApiError("validacao", "CSV obrigatório.");
    return ok(await importarContatosCsv(session, csvText), 202);
  } catch (err) {
    return handleError(err);
  }
}
