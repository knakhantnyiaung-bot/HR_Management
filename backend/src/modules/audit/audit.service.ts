import type { Prisma, PrismaClient } from "@prisma/client";
import { prisma } from "@database/prisma";

interface RecordAuditInput {
  organizationId: string;
  actorId?: string;
  action: string;
  resourceType: string;
  resourceId: string;
  metadata?: Prisma.InputJsonValue;
}

type DbClient = PrismaClient | Prisma.TransactionClient;

// HLD section 18 — every sensitive mutation in other modules should call this
// from within the same transaction as the mutation it is auditing, by
// passing the `tx` client through instead of the default `prisma` singleton.
export async function recordAudit(input: RecordAuditInput, client: DbClient = prisma) {
  return client.auditLog.create({ data: input });
}
