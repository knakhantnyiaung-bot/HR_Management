import type { Prisma } from "@prisma/client";
import { prisma } from "@database/prisma";

interface RecordAuditInput {
  organizationId: string;
  actorId?: string;
  action: string;
  resourceType: string;
  resourceId: string;
  metadata?: Prisma.InputJsonValue;
}

// HLD section 18 — every sensitive mutation in other modules should call this
// from within the same transaction as the mutation it is auditing.
export async function recordAudit(input: RecordAuditInput) {
  return prisma.auditLog.create({ data: input });
}
