import { z } from "zod";
import type { Surface } from "@saas-frota/shared";
import { loginSurface, requireSession, destroySession } from "../authz/session";
import { toSessionDto } from "../authz/to-session-dto";
import { env } from "../env";
import { fail, handleError, ok } from "./respond";

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
  tenant: z.string().optional(),
});

export function postLogin(surface: Surface) {
  return async (req: Request) => {
    try {
      const body = loginSchema.parse(await req.json());
      const result = await loginSurface({
        surface,
        email: body.email,
        password: body.password,
        tenantSlug: body.tenant ?? env.defaultTenantSlug,
      });
      if (
        surface === "saas" &&
        result &&
        "mfa_required" in result &&
        result.mfa_required
      ) {
        return ok({
          mfa_required: true,
          mfa_token: result.mfa_token,
        });
      }
      const session = await requireSession(surface);
      return ok(toSessionDto(session));
    } catch (err) {
      if (err instanceof z.ZodError) {
        return fail("validacao", "E-mail e senha são obrigatórios.");
      }
      return handleError(err);
    }
  };
}

export function postLogout(surface: Surface) {
  return async () => {
    await destroySession(surface);
    return new Response(null, { status: 204 });
  };
}

export function getSessao(surface: Surface) {
  return async () => {
    try {
      const session = await requireSession(surface);
      return ok(toSessionDto(session));
    } catch (err) {
      return handleError(err);
    }
  };
}
