import type { SessionContext } from "../authz/session";
import { assertSaasRole } from "../authz/gates";
import { db } from "../db";
import { decodeCursor, encodeCursor, parsePaging } from "../http/pagination";

export async function listAvisos(session: SessionContext, url: URL) {
  assertSaasRole(session, "admin", "vendedor");
  const { limit, cursor } = parsePaging(url);
  const decoded = decodeCursor(cursor);
  const rows = await db.notificationOutbox.findMany({
    where: {
      tenantId: session.tenantId,
      // Commerce UX: treat null-era rows as commerce via default; filter category.
      category: "commerce",
      ...(decoded ? { id: { gt: decoded[0] } } : {}),
    },
    orderBy: { id: "asc" },
    take: limit + 1,
  });
  const page = rows.slice(0, limit);
  return {
    items: page.map((r) => ({
      id: r.id,
      channel: r.channel,
      recipient_role: r.recipientRole,
      // mask recipient lightly for list (still PII — keep short)
      recipient: r.recipient.length > 4 ? `${r.recipient.slice(0, 2)}***` : "***",
      template_key: r.templateKey,
      status: r.status,
      orcamento_id: r.orcamentoId,
      pedido_id: r.pedidoId,
      venda_id: r.vendaId,
      cadastro_request_id: r.cadastroRequestId,
      created_at: r.createdAt.toISOString(),
    })),
    next_cursor: rows.length > limit ? encodeCursor([page[page.length - 1]!.id]) : null,
  };
}
