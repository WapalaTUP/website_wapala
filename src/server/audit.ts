import "server-only";
import type { Prisma } from "../generated/prisma/client";
import type { RequestContext } from "./security/request-context";
export interface AuditEvent {
  actorType: "USER" | "SERVER_OPERATOR" | "ANONYMOUS";
  actorId?: string;
  action: string;
  entityId?: string;
  summary?: Record<string, string | number | boolean>;
  context: RequestContext;
}
export async function writeAudit(
  tx: Prisma.TransactionClient,
  event: AuditEvent,
) {
  const summary = event.summary || {};
  if (
    Object.keys(summary).some((k) => /password|token|hash|secret/i.test(k)) ||
    JSON.stringify(summary).length > 2048
  )
    throw new Error("Audit summary unsafe");
  return tx.auditLog.create({
    data: {
      actorType: event.actorType,
      actorId: event.actorId,
      action: event.action,
      entityId: event.entityId,
      summary,
      ipDigest: event.context.ipDigest,
      userAgent: event.context.userAgent.slice(0, 256),
      requestId: event.context.requestId,
    },
  });
}
