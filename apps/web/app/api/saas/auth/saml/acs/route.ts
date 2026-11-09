import { postSamlAcs } from "@/server/crm/security";
import { ApiError, handleError, ok } from "@/server/http/respond";
import { env } from "@/server/env";

export async function POST(req: Request) {
  try {
    const url = new URL(req.url);
    const contentType = req.headers.get("content-type") || "";
    let raw = "";
    let tenantSlug = url.searchParams.get("tenant") || undefined;
    let tenantId = url.searchParams.get("tenant_id") || undefined;
    if (contentType.includes("application/json")) {
      const body = (await req.json()) as Record<string, unknown>;
      raw = String(body.SAMLResponse ?? body.saml_response ?? "");
      tenantSlug = (body.tenant as string | undefined) ?? tenantSlug;
      tenantId = (body.tenant_id as string | undefined) ?? tenantId;
    } else {
      const form = await req.formData();
      raw = String(form.get("SAMLResponse") ?? "");
      tenantSlug = (form.get("tenant") as string | null) ?? tenantSlug;
    }
    if (!raw) throw new ApiError("validacao", "SAMLResponse obrigatório.");
    return ok(
      await postSamlAcs({
        tenantSlug: tenantSlug || env.defaultTenantSlug,
        tenantId,
        rawSamlResponse: raw,
      }),
    );
  } catch (err) {
    return handleError(err);
  }
}
