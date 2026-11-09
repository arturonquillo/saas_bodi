import type { SessionContext } from "../authz/session";
import { assertSaasRole } from "../authz/gates";
import { db } from "../db";
import { ApiError } from "../http/respond";
import { newId } from "../ids";
import { assertConversationVisible } from "./visibility";
import { contactDto, conversationDto } from "./dto";

const MODELS = new Set(["contact", "conversation"]);
const TYPES = new Set(["text", "number", "link", "date", "list", "checkbox"]);

function parseJson<T>(raw: string | null | undefined, fallback: T): T {
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export function attributeDto(row: {
  id: string;
  attributeModel: string;
  attributeDisplayType: string;
  attributeKey: string;
  attributeDisplayName: string;
  defaultValueJson: string | null;
  attributeValuesJson: string | null;
  createdAt: Date;
  updatedAt: Date;
}) {
  return {
    id: row.id,
    attribute_model: row.attributeModel,
    attribute_display_type: row.attributeDisplayType,
    attribute_key: row.attributeKey,
    attribute_display_name: row.attributeDisplayName,
    default_value: parseJson(row.defaultValueJson, null),
    attribute_values: parseJson(row.attributeValuesJson, null),
    created_at: row.createdAt.toISOString(),
    updated_at: row.updatedAt.toISOString(),
  };
}

export async function listAtributos(session: SessionContext, model?: string | null) {
  assertSaasRole(session, "admin", "vendedor");
  if (model && !MODELS.has(model)) throw new ApiError("validacao", "model inválido.");
  const rows = await db.customAttributeDefinition.findMany({
    where: {
      tenantId: session.tenantId,
      ...(model ? { attributeModel: model } : {}),
    },
    orderBy: { attributeKey: "asc" },
  });
  return { items: rows.map(attributeDto) };
}

export async function createAtributo(
  session: SessionContext,
  input: {
    attribute_model: string;
    attribute_display_type: string;
    attribute_key: string;
    attribute_display_name: string;
    default_value?: unknown;
    attribute_values?: unknown;
  },
) {
  assertSaasRole(session, "admin");
  if (!MODELS.has(input.attribute_model)) throw new ApiError("validacao", "model inválido.");
  if (!TYPES.has(input.attribute_display_type)) {
    throw new ApiError("validacao", "attribute_display_type inválido.");
  }
  const key = input.attribute_key?.trim();
  if (!key || !/^[a-z][a-z0-9_]*$/.test(key)) {
    throw new ApiError("validacao", "attribute_key inválido.");
  }
  if (!input.attribute_display_name?.trim()) {
    throw new ApiError("validacao", "attribute_display_name obrigatório.");
  }
  const existing = await db.customAttributeDefinition.findUnique({
    where: {
      tenantId_attributeModel_attributeKey: {
        tenantId: session.tenantId,
        attributeModel: input.attribute_model,
        attributeKey: key,
      },
    },
  });
  if (existing) throw new ApiError("validacao", "Atributo já existe.");
  const id = newId("cad");
  await db.customAttributeDefinition.create({
    data: {
      id,
      tenantId: session.tenantId,
      attributeModel: input.attribute_model,
      attributeDisplayType: input.attribute_display_type,
      attributeKey: key,
      attributeDisplayName: input.attribute_display_name.trim(),
      defaultValueJson:
        input.default_value === undefined ? null : JSON.stringify(input.default_value),
      attributeValuesJson:
        input.attribute_values === undefined ? null : JSON.stringify(input.attribute_values),
    },
  });
  return getAtributo(session, id);
}

export async function getAtributo(session: SessionContext, id: string) {
  assertSaasRole(session, "admin", "vendedor");
  const row = await db.customAttributeDefinition.findFirst({
    where: { id, tenantId: session.tenantId },
  });
  if (!row) throw new ApiError("nao_encontrado", "Não encontrado.");
  return attributeDto(row);
}

export async function patchAtributo(
  session: SessionContext,
  id: string,
  input: {
    attribute_display_name?: string;
    attribute_display_type?: string;
    default_value?: unknown;
    attribute_values?: unknown;
  },
) {
  assertSaasRole(session, "admin");
  const row = await db.customAttributeDefinition.findFirst({
    where: { id, tenantId: session.tenantId },
  });
  if (!row) throw new ApiError("nao_encontrado", "Não encontrado.");
  if (input.attribute_display_type && !TYPES.has(input.attribute_display_type)) {
    throw new ApiError("validacao", "attribute_display_type inválido.");
  }
  await db.customAttributeDefinition.update({
    where: { id },
    data: {
      attributeDisplayName: input.attribute_display_name?.trim(),
      attributeDisplayType: input.attribute_display_type,
      defaultValueJson:
        input.default_value === undefined ? undefined : JSON.stringify(input.default_value),
      attributeValuesJson:
        input.attribute_values === undefined ? undefined : JSON.stringify(input.attribute_values),
    },
  });
  return getAtributo(session, id);
}

export async function deleteAtributo(session: SessionContext, id: string) {
  assertSaasRole(session, "admin");
  const row = await db.customAttributeDefinition.findFirst({
    where: { id, tenantId: session.tenantId },
  });
  if (!row) throw new ApiError("nao_encontrado", "Não encontrado.");
  await db.customAttributeDefinition.delete({ where: { id } });
  return { id, deleted: true };
}

async function validateAttributeBag(
  tenantId: string,
  model: "contact" | "conversation",
  attributes: Record<string, unknown>,
) {
  const defs = await db.customAttributeDefinition.findMany({
    where: { tenantId, attributeModel: model },
  });
  const byKey = new Map(defs.map((d) => [d.attributeKey, d]));
  for (const key of Object.keys(attributes)) {
    if (!byKey.has(key)) {
      throw new ApiError("validacao", `Atributo desconhecido: ${key}`);
    }
  }
}

export async function patchConversaAtributos(
  session: SessionContext,
  conversationId: string,
  attributes: Record<string, unknown>,
) {
  assertSaasRole(session, "admin", "vendedor");
  const row = await db.conversation.findFirst({
    where: { id: conversationId, tenantId: session.tenantId },
    include: { contact: true, labels: { include: { label: true } }, inbox: { select: { vendedorSeeAll: true } } },
  });
  if (!row) throw new ApiError("nao_encontrado", "Não encontrado.");
  await assertConversationVisible(session, row);
  await validateAttributeBag(session.tenantId, "conversation", attributes);
  const bag = parseJson<Record<string, unknown>>(row.customAttributesJson, {});
  Object.assign(bag, attributes);
  await db.conversation.update({
    where: { id: conversationId },
    data: { customAttributesJson: JSON.stringify(bag) },
  });
  const updated = await db.conversation.findUniqueOrThrow({
    where: { id: conversationId },
    include: { contact: true, labels: { include: { label: true } } },
  });
  return {
    ...conversationDto(updated),
    custom_attributes: bag,
  };
}

export async function patchContatoAtributos(
  session: SessionContext,
  contactId: string,
  attributes: Record<string, unknown>,
) {
  assertSaasRole(session, "admin", "vendedor");
  const row = await db.contact.findFirst({
    where: { id: contactId, tenantId: session.tenantId },
  });
  if (!row) throw new ApiError("nao_encontrado", "Não encontrado.");
  await validateAttributeBag(session.tenantId, "contact", attributes);
  const bag = parseJson<Record<string, unknown>>(row.customAttributesJson, {});
  Object.assign(bag, attributes);
  await db.contact.update({
    where: { id: contactId },
    data: { customAttributesJson: JSON.stringify(bag) },
  });
  const updated = await db.contact.findUniqueOrThrow({ where: { id: contactId } });
  return {
    ...contactDto(updated),
    custom_attributes: bag,
  };
}
