import type { Prisma } from "@prisma/client";
import { prisma } from "@database/prisma";
import { AppError } from "@common/errors/AppError";
import { recordAudit } from "@modules/audit/audit.service";
import type { UpsertSalaryProfileInput } from "@modules/salary/salary.schema";

async function assertEmployeeInOrg(organizationId: string, employeeId: string) {
  const employee = await prisma.employee.findFirst({ where: { id: employeeId, organizationId } });
  if (!employee) {
    throw AppError.notFound("Employee");
  }
  return employee;
}

function todayUtcDate(): Date {
  return new Date(`${new Date().toISOString().slice(0, 10)}T00:00:00.000Z`);
}

// "Current" means effective as of today, not merely the latest row — a
// future-dated raise (effectiveFrom next month) must not show as current
// yet, or payroll/self-service views would show pay that hasn't started.
export async function getCurrentSalaryProfile(organizationId: string, employeeId: string) {
  await assertEmployeeInOrg(organizationId, employeeId);

  const today = todayUtcDate();
  const profile = await prisma.salaryProfile.findFirst({
    where: {
      employeeId,
      effectiveFrom: { lte: today },
      OR: [{ effectiveTo: null }, { effectiveTo: { gte: today } }],
    },
    orderBy: { effectiveFrom: "desc" },
  });

  if (!profile) {
    throw AppError.notFound("SalaryProfile");
  }
  return profile;
}

export async function listSalaryProfileHistory(organizationId: string, employeeId: string) {
  await assertEmployeeInOrg(organizationId, employeeId);
  return prisma.salaryProfile.findMany({
    where: { employeeId },
    orderBy: { effectiveFrom: "desc" },
  });
}

// HLD section 1: "Historical payroll remains stable after later salary
// changes" (ADR-005). A "PATCH" never mutates an existing SalaryProfile row
// — it closes out the currently-open one (sets effectiveTo) and inserts a
// new one, so any PayrollItem snapshot that already referenced the old row
// is untouched.
export async function upsertSalaryProfile(
  organizationId: string,
  employeeId: string,
  input: UpsertSalaryProfileInput,
  actorId: string,
) {
  await assertEmployeeInOrg(organizationId, employeeId);

  const effectiveFrom = input.effectiveFrom ?? todayUtcDate();

  return prisma.$transaction(async (tx) => {
    // Lock the employee row (not a salary_profiles row, which may not exist
    // yet on the very first profile) so two concurrent salary changes for
    // the same employee can't both see "no open profile" and both insert
    // one, leaving two simultaneously-open rows.
    const lockedEmployee = await tx.$queryRaw<Array<{ id: string }>>`
      SELECT id FROM employees WHERE id = ${employeeId} AND organization_id = ${organizationId}
      FOR UPDATE
    `;
    if (!lockedEmployee[0]) {
      throw AppError.notFound("Employee");
    }

    const open = await tx.salaryProfile.findFirst({
      where: { employeeId, effectiveTo: null },
      orderBy: { effectiveFrom: "desc" },
    });

    if (open && effectiveFrom <= open.effectiveFrom) {
      throw AppError.conflict(
        "SALARY_EFFECTIVE_DATE_TOO_EARLY",
        "New effective date must be after the current salary profile's effective date",
      );
    }

    if (open) {
      const effectiveTo = new Date(effectiveFrom);
      effectiveTo.setUTCDate(effectiveTo.getUTCDate() - 1);
      await tx.salaryProfile.update({ where: { id: open.id }, data: { effectiveTo } });
    }

    const created = await tx.salaryProfile.create({
      data: {
        employeeId,
        effectiveFrom,
        basicSalary: input.basicSalary,
        allowances: (input.allowances ?? {}) as Prisma.InputJsonValue,
        deductions: (input.deductions ?? {}) as Prisma.InputJsonValue,
        otSettings: input.otSettings as Prisma.InputJsonValue | undefined,
      },
    });

    await recordAudit(
      {
        organizationId,
        actorId,
        action: "SALARY_PROFILE_CHANGED",
        resourceType: "SalaryProfile",
        resourceId: created.id,
        metadata: {
          employeeId,
          effectiveFrom: effectiveFrom.toISOString(),
          basicSalary: input.basicSalary,
          previousProfileId: open?.id ?? null,
        },
      },
      tx,
    );

    return created;
  });
}
