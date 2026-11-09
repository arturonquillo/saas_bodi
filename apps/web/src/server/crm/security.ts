import { createHash, randomBytes } from "node:crypto";
import type { SessionContext } from "../authz/session";
import { assertSaasRole } from "../authz/gates";
import { db } from "../db";
import { ApiError } from "../http/respond";
import { newId } from "../ids";
import { channelCredentialsVault } from "../ports/credentials-vault";
import { samlAuthPort } from "../ports/saml-auth";
import {
  clearPendingMfaSecret,
  mfaPort,
  peekPendingMfaSecret,
  setPendingMfaSecret,
} from "../ports/mfa";
import { appendDomainEvent } from "./events";
import { recordAudit } from "./audit";
import { createSession } from "../authz/session";

export function samlDto(row: {
  id: string;
  enabled: boolean;
  idpEntityId: string | null;
  idpSsoUrl: string | null;
  idpCertificateCiphertext: string | null;
  spEntityId: string | null;
  jitProvision: boolean;
  updatedAt: Date;
}) {
  return {
    id: row.id,
    enabled: row.enabled,
    idp_entity_id: row.idpEntityId,
    idp_sso_url: row.idpSsoUrl,
    certificate_present: Boolean(row.idpCertificateCiphertext),
    sp_entity_id: row.spEntityId,
    jit_provision: row.jitProvision,
    updated_at: row.updatedAt.toISOString(),
  };
}

export async function getSaml(session: SessionContext) {
  assertSaasRole(session, "admin");
  const row = await db.samlConfig.findUnique({ where: { tenantId: session.tenantId } });
  if (!row) {
    return {
      enabled: false,
      idp_entity_id: null,
      idp_sso_url: null,
      certificate_present: false,
      sp_entity_id: null,
      jit_provision: false,
    };
  }
  return samlDto(row);
}

export async function putSaml(
  session: SessionContext,
  input: {
    enabled?: boolean;
    idp_entity_id?: string | null;
    idp_sso_url?: string | null;
    idp_certificate_pem?: string | null;
    sp_entity_id?: string | null;
    jit_provision?: boolean;
  },
) {
  assertSaasRole(session, "admin");
  const existing = await db.samlConfig.findUnique({ where: { tenantId: session.tenantId } });
  let certCipher: string | null | undefined = undefined;
  if (input.idp_certificate_pem !== undefined) {
    if (input.idp_certificate_pem) {
      certCipher = await channelCredentialsVault.seal({
        certificate_pem: input.idp_certificate_pem,
      });
    } else {
      certCipher = null;
    }
  }
  const spDefault = `urn:saas-frota:sp:${session.tenantId}`;
  if (existing) {
    await db.samlConfig.update({
      where: { id: existing.id },
      data: {
        enabled: input.enabled,
        idpEntityId: input.idp_entity_id === undefined ? undefined : input.idp_entity_id,
        idpSsoUrl: input.idp_sso_url === undefined ? undefined : input.idp_sso_url,
        idpCertificateCiphertext: certCipher,
        spEntityId: input.sp_entity_id === undefined ? undefined : input.sp_entity_id || spDefault,
        jitProvision: input.jit_provision,
      },
    });
  } else {
    await db.samlConfig.create({
      data: {
        id: newId("sml"),
        tenantId: session.tenantId,
        enabled: input.enabled ?? false,
        idpEntityId: input.idp_entity_id ?? null,
        idpSsoUrl: input.idp_sso_url ?? null,
        idpCertificateCiphertext: certCipher ?? null,
        spEntityId: input.sp_entity_id || spDefault,
        jitProvision: input.jit_provision ?? false,
      },
    });
  }
  await appendDomainEvent(db, {
    tenantId: session.tenantId,
    type: "saml.updated",
    aggregateType: "saml_config",
    aggregateId: session.tenantId,
    actorUserId: session.userId,
    payload: { enabled: input.enabled ?? existing?.enabled ?? false },
  });
  await recordAudit({
    tenantId: session.tenantId,
    actorUserId: session.userId,
    action: "saml.updated",
    aggregateType: "saml_config",
    aggregateId: session.tenantId,
    payload: { enabled: input.enabled ?? existing?.enabled ?? false },
  });
  return getSaml(session);
}

export async function testSaml(session: SessionContext) {
  assertSaasRole(session, "admin");
  const result = await samlAuthPort.validateAssertion({
    tenantId: session.tenantId,
    rawSamlResponse: "FIXTURE_OK",
  });
  return { ok: result.ok, stub: true as const, result };
}

export async function getSamlMetadataPublic(tenantSlug: string) {
  const tenant = await db.tenant.findUnique({ where: { slug: tenantSlug } });
  if (!tenant) throw new ApiError("nao_encontrado", "Tenant não encontrado.");
  const cfg = await db.samlConfig.findUnique({ where: { tenantId: tenant.id } });
  if (!cfg) throw new ApiError("nao_encontrado", "SAML não configurado.");
  const xml = await samlAuthPort.getSpMetadata(tenant.id);
  return xml;
}

export async function postSamlAcs(input: {
  tenantSlug?: string;
  tenantId?: string;
  rawSamlResponse: string;
}) {
  let tenantId = input.tenantId;
  if (!tenantId && input.tenantSlug) {
    const tenant = await db.tenant.findUnique({ where: { slug: input.tenantSlug } });
    if (!tenant) throw new ApiError("nao_encontrado", "Tenant não encontrado.");
    tenantId = tenant.id;
  }
  if (!tenantId) throw new ApiError("validacao", "tenant obrigatório.");
  const result = await samlAuthPort.validateAssertion({
    tenantId,
    rawSamlResponse: input.rawSamlResponse,
  });
  if (!result.ok) {
    throw new ApiError("unauthenticated", `SAML rejeitado: ${result.reason}`);
  }
  return { ok: true, name_id: result.nameId, email: result.email, stub: true as const };
}

export async function getMfaStatus(session: SessionContext) {
  assertSaasRole(session, "admin", "vendedor");
  const device = await db.mfaDevice.findFirst({
    where: { tenantId: session.tenantId, userId: session.userId },
  });
  const tenant = await db.tenant.findUniqueOrThrow({ where: { id: session.tenantId } });
  return {
    enrolled: Boolean(device?.enabled && device.confirmedAt),
    enabled: Boolean(device?.enabled),
    mfa_required: tenant.mfaRequired,
  };
}

export async function iniciarMfa(session: SessionContext) {
  assertSaasRole(session, "admin", "vendedor");
  const { secret, otpauthUri } = await mfaPort.enroll(session.userId);
  const ciphertext = await channelCredentialsVault.seal({ totp_secret: secret });
  const existing = await db.mfaDevice.findFirst({
    where: { tenantId: session.tenantId, userId: session.userId },
  });
  if (existing) {
    await db.mfaDevice.update({
      where: { id: existing.id },
      data: {
        secretCiphertext: ciphertext,
        enabled: false,
        confirmedAt: null,
        recoveryCodesHashJson: "[]",
      },
    });
  } else {
    await db.mfaDevice.create({
      data: {
        id: newId("mfa"),
        tenantId: session.tenantId,
        userId: session.userId,
        secretCiphertext: ciphertext,
        enabled: false,
      },
    });
  }
  setPendingMfaSecret(session.userId, secret);
  return { secret, otpauth_uri: otpauthUri };
}

export async function confirmarMfa(session: SessionContext, input: { code: string }) {
  assertSaasRole(session, "admin", "vendedor");
  const ok = await mfaPort.verify(session.userId, input.code);
  if (!ok) throw new ApiError("validacao", "Código MFA inválido.");
  const device = await db.mfaDevice.findFirst({
    where: { tenantId: session.tenantId, userId: session.userId },
  });
  if (!device) throw new ApiError("validacao", "MFA não iniciado.");
  const recovery = Array.from({ length: 8 }, () => randomBytes(4).toString("hex"));
  const hashes = recovery.map((c) => createHash("sha256").update(c).digest("hex"));
  await db.mfaDevice.update({
    where: { id: device.id },
    data: {
      enabled: true,
      confirmedAt: new Date(),
      recoveryCodesHashJson: JSON.stringify(hashes),
    },
  });
  clearPendingMfaSecret(session.userId);
  await appendDomainEvent(db, {
    tenantId: session.tenantId,
    type: "mfa.enrolled",
    aggregateType: "user",
    aggregateId: session.userId,
    actorUserId: session.userId,
    payload: { user_id: session.userId },
  });
  await recordAudit({
    tenantId: session.tenantId,
    actorUserId: session.userId,
    action: "mfa.enrolled",
    aggregateType: "user",
    aggregateId: session.userId,
    payload: {},
  });
  return { ok: true, recovery_codes: recovery };
}

export async function desativarMfa(session: SessionContext, input: { code?: string }) {
  assertSaasRole(session, "admin", "vendedor");
  const device = await db.mfaDevice.findFirst({
    where: { tenantId: session.tenantId, userId: session.userId },
  });
  if (!device?.enabled) throw new ApiError("validacao", "MFA não está ativo.");
  // Reload secret into pending so verify works
  const opened = await channelCredentialsVault.open(device.secretCiphertext);
  if (opened.totp_secret) setPendingMfaSecret(session.userId, opened.totp_secret);
  if (input.code) {
    const ok = await mfaPort.verify(session.userId, input.code);
    if (!ok) throw new ApiError("validacao", "Código MFA inválido.");
  }
  await db.mfaDevice.update({
    where: { id: device.id },
    data: { enabled: false, confirmedAt: null },
  });
  await mfaPort.disable(session.userId);
  await appendDomainEvent(db, {
    tenantId: session.tenantId,
    type: "mfa.disabled",
    aggregateType: "user",
    aggregateId: session.userId,
    actorUserId: session.userId,
    payload: { user_id: session.userId },
  });
  await recordAudit({
    tenantId: session.tenantId,
    actorUserId: session.userId,
    action: "mfa.disabled",
    aggregateType: "user",
    aggregateId: session.userId,
    payload: {},
  });
  return { ok: true };
}

export async function adminResetMfa(session: SessionContext, userId: string) {
  assertSaasRole(session, "admin");
  const device = await db.mfaDevice.findFirst({
    where: { tenantId: session.tenantId, userId },
  });
  if (device) {
    await db.mfaDevice.update({
      where: { id: device.id },
      data: { enabled: false, confirmedAt: null },
    });
  }
  await mfaPort.disable(userId);
  await recordAudit({
    tenantId: session.tenantId,
    actorUserId: session.userId,
    action: "mfa.admin_reset",
    aggregateType: "user",
    aggregateId: userId,
    payload: {},
  });
  return { ok: true };
}

export async function putPoliticaSeguranca(
  session: SessionContext,
  input: { mfa_required?: boolean; saml_enabled?: boolean; jit_provision?: boolean },
) {
  assertSaasRole(session, "admin");
  if (input.mfa_required !== undefined) {
    await db.tenant.update({
      where: { id: session.tenantId },
      data: { mfaRequired: input.mfa_required },
    });
  }
  if (input.saml_enabled !== undefined || input.jit_provision !== undefined) {
    await putSaml(session, {
      enabled: input.saml_enabled,
      jit_provision: input.jit_provision,
    });
  }
  const tenant = await db.tenant.findUniqueOrThrow({ where: { id: session.tenantId } });
  const saml = await getSaml(session);
  return {
    mfa_required: tenant.mfaRequired,
    saml_enabled: saml.enabled,
    jit_provision: "jit_provision" in saml ? saml.jit_provision : false,
  };
}

/** Pending MFA challenge tokens (hash → user/tenant). */
const mfaChallenges = new Map<
  string,
  { userId: string; tenantId: string; expiresAt: number }
>();

export function createMfaChallenge(userId: string, tenantId: string) {
  const token = randomBytes(24).toString("hex");
  const hash = createHash("sha256").update(token).digest("hex");
  mfaChallenges.set(hash, {
    userId,
    tenantId,
    expiresAt: Date.now() + 5 * 60 * 1000,
  });
  return token;
}

export async function completeMfaLogin(input: { mfa_token: string; code: string }) {
  const hash = createHash("sha256").update(input.mfa_token).digest("hex");
  const challenge = mfaChallenges.get(hash);
  if (!challenge || challenge.expiresAt < Date.now()) {
    throw new ApiError("unauthenticated", "Desafio MFA inválido ou expirado.");
  }
  const device = await db.mfaDevice.findFirst({
    where: {
      tenantId: challenge.tenantId,
      userId: challenge.userId,
      enabled: true,
    },
  });
  if (!device) throw new ApiError("unauthenticated", "MFA não configurado.");
  const opened = await channelCredentialsVault.open(device.secretCiphertext);
  if (opened.totp_secret) setPendingMfaSecret(challenge.userId, opened.totp_secret);
  const ok = await mfaPort.verify(challenge.userId, input.code);
  if (!ok) throw new ApiError("unauthenticated", "Código MFA inválido.");
  mfaChallenges.delete(hash);
  clearPendingMfaSecret(challenge.userId);
  await createSession({
    userId: challenge.userId,
    tenantId: challenge.tenantId,
    surface: "saas",
  });
  return { userId: challenge.userId, tenantId: challenge.tenantId };
}

export async function userHasMfaEnabled(tenantId: string, userId: string) {
  const device = await db.mfaDevice.findFirst({
    where: { tenantId, userId, enabled: true },
  });
  return Boolean(device?.confirmedAt);
}

/** Test helper: expose peek for sealed secrets. */
export { peekPendingMfaSecret };
