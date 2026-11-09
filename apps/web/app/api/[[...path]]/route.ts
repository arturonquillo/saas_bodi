import { handleMockApi, parseCookies } from "@/mocks/handler";

export const dynamic = "force-dynamic";

/**
 * Temporary contract-shaped mock API for the frontend PR.
 * Backend sibling will replace with Prisma-backed routes; shapes match docs/architecture/api.md.
 * Flag note: always on in this branch until real routes land.
 */
async function dispatch(req: Request, ctx: { params: Promise<{ path?: string[] }> }) {
  const { path = [] } = await ctx.params;
  let body: unknown = null;
  if (req.method !== "GET" && req.method !== "HEAD") {
    const text = await req.text();
    if (text) {
      try {
        body = JSON.parse(text);
      } catch {
        body = null;
      }
    }
  }
  const url = new URL(req.url);
  return handleMockApi({
    method: req.method,
    path: path.join("/"),
    search: url.searchParams,
    body,
    cookies: parseCookies(req.headers.get("cookie")),
  });
}

export const GET = dispatch;
export const POST = dispatch;
export const PUT = dispatch;
export const PATCH = dispatch;
export const DELETE = dispatch;
