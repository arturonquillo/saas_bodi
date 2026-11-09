import {
  INTEGRATION_CONNECTION_MAX,
  INTEGRATION_CONNECTION_STATUSES,
  INTEGRATION_PROVIDERS,
  type IntegrationConnectionStatus,
  type IntegrationProvider,
} from "@saas-frota/shared";
import type { SessionContext } from "../authz/session";
import { assertSaasRole } from "../authz/gates";
import { db } from "../db";
import { ApiError } from "../http/respond";
import { newId } from "../ids";
import { channelCredentialsVault } from "../ports/credentials-vault";
import { integrationConnectPort } from "../ports/integration-connect";
import { appendDomainEvent } from "./events";
import { recordAudit } from "./audit";

const STATUS_RANK: Record<IntegrationConnectionStatus, number> = {
  not_configured: 0,
  credentials_saved: 1,
  connected_stub: 2,
  live: 3,
};

function rejectLive(status?: IntegrationConnectionStatus) {
  if (status === "live") {
    throw new ApiError(
      "nao_implementado",
      "Status live não está disponível até a integração do provedor ser liberada.",
    );
  }
  if (status && STATUS_RANK[status] > STATUS_RANK[INTEGRATION_CONNECTION_MAX]) {
    throw new ApiError("validacao", "Status de conexão acima de connected_stub não permitido.");
  }
}

function assertProvider(provider: string): IntegrationProvider {
  if (!(INTEGRATION_PROVIDERS as readonly string[]).includes(provider)) {
    throw new ApiError("validacao", `Provedor inválido: ${provider}`);
  }
  return provider as IntegrationProvider;
}

export function integrationDto(row: {
  id: string;
  provider: string;
  connectionStatus: string;
  metadataJson: string | null;
  secretsCiphertext: string | null;
  updatedAt: Date;
  createdAt: Date;
}) {
  let metadata: unknown = null;
  try {
    metadata = row.metadataJson ? JSON.parse(row.metadataJson) : null;
  } catch {
    metadata = null;
  }
  return {
    provider: row.provider,
    id: row.id,
    connection_status: row.connectionStatus,
    metadata,
    secrets_present: Boolean(row.secretsCiphertext),
    updated_at: row.updatedAt.toISOString(),
    created_at: row.createdAt.toISOString(),
  };
}

export async function listIntegracoes(session: SessionContext) {
  assertSaasRole(session, "admin");
  const installs = await db.integrationInstall.findMany({
    where: { tenantId: session.tenantId },
  });
  const byProvider = new Map(installs.map((i) => [i.provider, i]));
  return {
    items: INTEGRATION_PROVIDERS.map((provider) => {
      const row = byProvider.get(provider);
      if (!row) {
        return {
          provider,
          connection_status: "not_configured",
          metadata: null,
          secrets_present: false,
        };
      }
      return integrationDto(row);
    }),
  };
}

export async function getIntegracao(session: SessionContext, providerRaw: string) {
  assertSaasRole(session, "admin");
  const provider = assertProvider(providerRaw);
  const row = await db.integrationInstall.findFirst({
    where: { tenantId: session.tenantId, provider },
  });
  if (!row) {
    return {
      provider,
      connection_status: "not_configured",
      metadata: null,
      secrets_present: false,
    };
  }
  return integrationDto(row);
}

export async function putIntegracao(
  session: SessionContext,
  providerRaw: string,
  input: {
    connection_status?: IntegrationConnectionStatus;
    metadata?: Record<string, unknown> | null;
    secrets?: Record<string, string>;
  },
) {
  assertSaasRole(session, "admin");
  const provider = assertProvider(providerRaw);
  const status = input.connection_status;
  if (status && !(INTEGRATION_CONNECTION_STATUSES as readonly string[]).includes(status)) {
    throw new ApiError("validacao", "connection_status inválido.");
  }
  rejectLive(status);

  const existing = await db.integrationInstall.findFirst({
    where: { tenantId: session.tenantId, provider },
  });
  let secretsCiphertext: string | null | undefined = undefined;
  if (input.secrets && Object.keys(input.secrets).length) {
    let merged: Record<string, string> = {};
    if (existing?.secretsCiphertext) {
      merged = await channelCredentialsVault.open(existing.secretsCiphertext);
    }
    secretsCiphertext = await channelCredentialsVault.seal({ ...merged, ...input.secrets });
  }

  const nextStatus =
    status ??
    (secretsCiphertext || existing?.secretsCiphertext
      ? "credentials_saved"
      : existing?.connectionStatus ?? "not_configured");
  rejectLive(nextStatus as IntegrationConnectionStatus);

  if (existing) {
    await db.integrationInstall.update({
      where: { id: existing.id },
      data: {
        connectionStatus: nextStatus,
        metadataJson:
          input.metadata === undefined
            ? undefined
            : input.metadata
              ? JSON.stringify(input.metadata)
              : null,
        secretsCiphertext: secretsCiphertext === undefined ? undefined : secretsCiphertext,
      },
    });
  } else {
    await db.integrationInstall.create({
      data: {
        id: newId("igi"),
        tenantId: session.tenantId,
        provider,
        connectionStatus: nextStatus,
        metadataJson: input.metadata ? JSON.stringify(input.metadata) : null,
        secretsCiphertext: secretsCiphertext ?? null,
      },
    });
  }
  await appendDomainEvent(db, {
    tenantId: session.tenantId,
    type: "integration.updated",
    aggregateType: "integration",
    aggregateId: provider,
    actorUserId: session.userId,
    payload: { provider, connection_status: nextStatus },
  });
  await recordAudit({
    tenantId: session.tenantId,
    actorUserId: session.userId,
    action: "integration.updated",
    aggregateType: "integration",
    aggregateId: provider,
    payload: { provider, connection_status: nextStatus },
  });
  return getIntegracao(session, provider);
}

export async function disconnectIntegracao(session: SessionContext, providerRaw: string) {
  assertSaasRole(session, "admin");
  const provider = assertProvider(providerRaw);
  const existing = await db.integrationInstall.findFirst({
    where: { tenantId: session.tenantId, provider },
  });
  if (existing) {
    await db.integrationInstall.update({
      where: { id: existing.id },
      data: {
        connectionStatus: "not_configured",
        secretsCiphertext: null,
        metadataJson: null,
      },
    });
  }
  await appendDomainEvent(db, {
    tenantId: session.tenantId,
    type: "integration.updated",
    aggregateType: "integration",
    aggregateId: provider,
    actorUserId: session.userId,
    payload: { provider, connection_status: "not_configured", disconnected: true },
  });
  return getIntegracao(session, provider);
}

export async function testIntegracao(session: SessionContext, providerRaw: string) {
  assertSaasRole(session, "admin");
  const provider = assertProvider(providerRaw);
  const result = await integrationConnectPort.test({
    tenantId: session.tenantId,
    provider,
  });
  return { ok: result.ok, stub: true as const, provider };
}
