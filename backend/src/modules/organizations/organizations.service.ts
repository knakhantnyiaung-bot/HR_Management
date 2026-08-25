import type { Prisma } from "@prisma/client";
import { prisma } from "@database/prisma";
import { AppError } from "@common/errors/AppError";
import { recordAudit } from "@modules/audit/audit.service";
import type { UpdateOrganizationInput } from "@modules/organizations/organizations.schema";

export async function getOrganization(organizationId: string) {
  return prisma.organization.findUniqueOrThrow({ where: { id: organizationId } });
}

// ORG-03: currency changes are blocked once payroll history exists for this
// organization — no migration/re-statement workflow exists in MVP scope.
export async function updateOrganization(
  organizationId: string,
  input: UpdateOrganizationInput,
  actorId: string,
) {
  const existing = await prisma.organization.findUniqueOrThrow({ where: { id: organizationId } });

  if (input.currency && input.currency !== existing.currency) {
    const hasPayrollHistory = (await prisma.payrollRun.count({ where: { organizationId } })) > 0;
    if (hasPayrollHistory) {
      throw AppError.conflict(
        "CURRENCY_CHANGE_BLOCKED",
        "Currency cannot be changed once payroll history exists for this organization",
      );
    }
  }

  return prisma.$transaction(async (tx) => {
    const updated = await tx.organization.update({ where: { id: organizationId }, data: input });

    await recordAudit(
      {
        organizationId,
        actorId,
        action: "ORGANIZATION_UPDATED",
        resourceType: "Organization",
        resourceId: organizationId,
        metadata: input as Prisma.InputJsonValue,
      },
      tx,
    );

    return updated;
  });
}
