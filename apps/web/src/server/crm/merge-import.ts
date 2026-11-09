import type { SessionContext } from "../authz/session";
import { assertSaasRole } from "../authz/gates";
import { db } from "../db";
import { ApiError } from "../http/respond";
import { newId } from "../ids";
import { jobEnqueuePort } from "../ports/jobs";
import { appendDomainEvent } from "./events";
import { contactDto } from "./dto";

const MAX_CSV_ROWS = 5000;
const PREVIEW_ROWS = 20;

export async function mesclarContatos(
  session: SessionContext,
  input: { survivor_id: string; loser_id: string },
) {
  assertSaasRole(session, "admin", "vendedor");
  if (!input.survivor_id || !input.loser_id) {
    throw new ApiError("validacao", "survivor_id e loser_id obrigatórios.");
  }
  if (input.survivor_id === input.loser_id) {
    throw new ApiError("validacao", "Contatos devem ser distintos.");
  }
  const survivor = await db.contact.findFirst({
    where: { id: input.survivor_id, tenantId: session.tenantId },
  });
  const loser = await db.contact.findFirst({
    where: { id: input.loser_id, tenantId: session.tenantId },
  });
  if (!survivor || !loser) throw new ApiError("nao_encontrado", "Não encontrado.");
  if (loser.mergedIntoId) throw new ApiError("validacao", "Contato já mesclado.");

  // Preserve Cliente on survivor — prefer survivor.clienteId, else take loser's.
  const clienteId = survivor.clienteId ?? loser.clienteId ?? null;
  const companyId = survivor.companyId ?? loser.companyId ?? null;
  const cadastroRequestId = survivor.cadastroRequestId ?? loser.cadastroRequestId ?? null;
  const email = survivor.email ?? loser.email;
  const phone = survivor.phoneE164 ?? loser.phoneE164;
  const notas = [survivor.notas, loser.notas].filter(Boolean).join("\n") || null;

  const survivorAttrs = JSON.parse(survivor.customAttributesJson || "{}") as Record<string, unknown>;
  const loserAttrs = JSON.parse(loser.customAttributesJson || "{}") as Record<string, unknown>;
  const mergedAttrs = { ...loserAttrs, ...survivorAttrs };

  await db.$transaction(async (tx) => {
    await tx.conversation.updateMany({
      where: { tenantId: session.tenantId, contactId: loser.id },
      data: { contactId: survivor.id },
    });
    const loserInboxes = await tx.contactInbox.findMany({
      where: { tenantId: session.tenantId, contactId: loser.id },
    });
    for (const ci of loserInboxes) {
      const clash = await tx.contactInbox.findFirst({
        where: {
          tenantId: session.tenantId,
          inboxId: ci.inboxId,
          sourceId: ci.sourceId,
          contactId: survivor.id,
        },
      });
      if (clash) {
        await tx.contactInbox.delete({ where: { id: ci.id } });
      } else {
        await tx.contactInbox.update({
          where: { id: ci.id },
          data: { contactId: survivor.id },
        });
      }
    }
    const loserLabels = await tx.contactLabel.findMany({
      where: { tenantId: session.tenantId, contactId: loser.id },
    });
    for (const cl of loserLabels) {
      const exists = await tx.contactLabel.findUnique({
        where: { contactId_labelId: { contactId: survivor.id, labelId: cl.labelId } },
      });
      if (exists) {
        await tx.contactLabel.delete({ where: { id: cl.id } });
      } else {
        await tx.contactLabel.update({
          where: { id: cl.id },
          data: { contactId: survivor.id },
        });
      }
    }
    await tx.cliente.updateMany({
      where: { tenantId: session.tenantId, primaryContactId: loser.id },
      data: { primaryContactId: survivor.id },
    });
    await tx.csatResponse.updateMany({
      where: { tenantId: session.tenantId, contactId: loser.id },
      data: { contactId: survivor.id },
    });
    await tx.contact.update({
      where: { id: survivor.id },
      data: {
        clienteId,
        companyId,
        cadastroRequestId,
        email,
        phoneE164: phone,
        notas,
        customAttributesJson: JSON.stringify(mergedAttrs),
      },
    });
    await tx.contact.update({
      where: { id: loser.id },
      data: {
        mergedIntoId: survivor.id,
        clienteId: null,
        cadastroRequestId: null,
      },
    });
  });

  await appendDomainEvent(db, {
    tenantId: session.tenantId,
    type: "contact.merged",
    aggregateType: "contact",
    aggregateId: survivor.id,
    actorUserId: session.userId,
    payload: {
      survivor_id: survivor.id,
      loser_id: loser.id,
      cliente_id: clienteId,
    },
  });

  const updated = await db.contact.findUniqueOrThrow({ where: { id: survivor.id } });
  return contactDto(updated);
}

function parseCsv(text: string): Array<Record<string, string>> {
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
  if (!lines.length) return [];
  const headers = lines[0]!.split(",").map((h) => h.trim().toLowerCase());
  const rows: Array<Record<string, string>> = [];
  for (const line of lines.slice(1)) {
    const cols = line.split(",").map((c) => c.trim());
    const row: Record<string, string> = {};
    headers.forEach((h, i) => {
      row[h] = cols[i] ?? "";
    });
    rows.push(row);
  }
  return rows;
}

export async function previewImportCsv(session: SessionContext, csvText: string) {
  assertSaasRole(session, "admin", "vendedor");
  if (!csvText?.trim()) throw new ApiError("validacao", "CSV vazio.");
  const rows = parseCsv(csvText);
  if (rows.length > MAX_CSV_ROWS) {
    throw new ApiError("validacao", `Máximo de ${MAX_CSV_ROWS} linhas.`);
  }
  return {
    total_rows: rows.length,
    preview: rows.slice(0, PREVIEW_ROWS),
    dry_run: true,
  };
}

export async function importarContatosCsv(session: SessionContext, csvText: string) {
  assertSaasRole(session, "admin", "vendedor");
  if (!csvText?.trim()) throw new ApiError("validacao", "CSV vazio.");
  const rows = parseCsv(csvText);
  if (rows.length > MAX_CSV_ROWS) {
    throw new ApiError("validacao", `Máximo de ${MAX_CSV_ROWS} linhas.`);
  }
  const batchId = newId("cib");
  await db.contactImportBatch.create({
    data: {
      id: batchId,
      tenantId: session.tenantId,
      createdByUserId: session.userId,
      status: "pendente",
      statsJson: JSON.stringify({ total: rows.length, created: 0, updated: 0, errors: 0 }),
      csvText,
    },
  });
  await jobEnqueuePort.enqueue({
    tenantId: session.tenantId,
    kind: "contact.import_csv",
    payload: { batch_id: batchId },
  });
  return { batch_id: batchId, status: "pendente" };
}

export async function getImportBatch(session: SessionContext, batchId: string) {
  assertSaasRole(session, "admin", "vendedor");
  const row = await db.contactImportBatch.findFirst({
    where: { id: batchId, tenantId: session.tenantId },
  });
  if (!row) throw new ApiError("nao_encontrado", "Não encontrado.");
  return {
    batch_id: row.id,
    status: row.status,
    stats: JSON.parse(row.statsJson || "{}") as Record<string, unknown>,
    last_error: row.lastError,
    created_at: row.createdAt.toISOString(),
    updated_at: row.updatedAt.toISOString(),
  };
}

export async function processContactImportBatch(batchId: string, tenantId: string) {
  const batch = await db.contactImportBatch.findFirst({
    where: { id: batchId, tenantId },
  });
  if (!batch || !batch.csvText) return;
  await db.contactImportBatch.update({
    where: { id: batchId },
    data: { status: "processando" },
  });
  const rows = parseCsv(batch.csvText);
  let created = 0;
  let updated = 0;
  let errors = 0;
  for (const row of rows) {
    try {
      const nome = row.nome || row.name || row.phone_e164 || row.phone || "Contato";
      const phone = row.phone_e164 || row.phone || null;
      const email = row.email || null;
      let existing = null as Awaited<ReturnType<typeof db.contact.findFirst>>;
      if (phone) {
        existing = await db.contact.findFirst({
          where: { tenantId, phoneE164: phone, mergedIntoId: null },
        });
      }
      if (!existing && email) {
        existing = await db.contact.findFirst({
          where: { tenantId, email, mergedIntoId: null },
        });
      }
      if (existing) {
        await db.contact.update({
          where: { id: existing.id },
          data: {
            nome: nome || existing.nome,
            email: email ?? existing.email,
            phoneE164: phone ?? existing.phoneE164,
          },
        });
        updated += 1;
      } else {
        await db.contact.create({
          data: {
            id: newId("ct"),
            tenantId,
            nome,
            email,
            phoneE164: phone,
          },
        });
        created += 1;
      }
    } catch {
      errors += 1;
    }
  }
  await db.contactImportBatch.update({
    where: { id: batchId },
    data: {
      status: "concluido",
      statsJson: JSON.stringify({ total: rows.length, created, updated, errors }),
      csvText: null,
    },
  });
  await appendDomainEvent(db, {
    tenantId,
    type: "contact.imported",
    aggregateType: "contact_import_batch",
    aggregateId: batchId,
    payload: { batch_id: batchId, created, updated, errors, total: rows.length },
  });
}
