import { ok } from "@/server/http/respond";

export async function GET() {
  return ok({ ok: true });
}
