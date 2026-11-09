import { getSamlMetadataPublic } from "@/server/crm/security";
import { handleError } from "@/server/http/respond";
import { env } from "@/server/env";

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const slug = url.searchParams.get("tenant") || env.defaultTenantSlug;
    const xml = await getSamlMetadataPublic(slug);
    return new Response(xml, {
      status: 200,
      headers: { "content-type": "application/samlmetadata+xml; charset=utf-8" },
    });
  } catch (err) {
    return handleError(err);
  }
}
