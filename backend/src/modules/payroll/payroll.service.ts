import type { PrismaClient } from "@prisma/client";
import { PayrollRunStatus, Prisma } from "@prisma/client";
import { prisma } from "@database/prisma";
import { AppError } from "@common/errors/AppError";
import { recordAudit } from "@modules/audit/audit.service";
import { calculatePayrollItem, periodToDateRange } from "@modules/payroll/payroll.calculator";
import type { ListPayrollRunsQuery } from "@modules/payroll/payroll.schema";

type DbClient = PrismaClient | Prisma.TransactionClient;

const PAYROLL_RUN_INCLUDE = {
  items: {
    include: {
      employee: { select: { id: true, employeeNo: true, user: { select: { email: true } } } },
    },
    orderBy: { employee: { employeeNo: "asc" } },
  },
} satisfies Prisma.PayrollRunInclude;

function round2(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function asAmountRecord(value: Prisma.JsonValue): Record<string, number> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const result: Record<string, number> = {};
  for (const [key, v] of Object.entries(value as Record<string, unknown>)) {
    const n = typeof v === "number" ? v : Number(v);
    if (Number.isFinite(n)) result[key] = n;
  }
  return result;
}

function extractOtSettings(
  value: Prisma.JsonValue | null,
): { standardMonthlyHours?: number; standardWorkingDays?: number } {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const obj = value as Record<string, unknown>;
  const settings: { standardMonthlyHours?: number; standardWorkingDays?: number } = {};
  if (typeof obj.standardMonthlyHours === "number") settings.standardMonthlyHours = obj.standardMonthlyHours;
  if (typeof obj.standardWorkingDays === "number") settings.standardWorkingDays = obj.standardWorkingDays;
  return settings;
}

async function reloadPayrollRun(client: DbClient, runId: string) {
  return client.payrollRun.findUniqueOrThrow({ where: { id: runId }, include: PAYROLL_RUN_INCLUDE });
}

export async function getPayrollRunById(organizationId: string, runId: string) {
  const run = await prisma.payrollRun.findFirst({
    where: { id: runId, organizationId },
    include: PAYROLL_RUN_INCLUDE,
  });
  if (!run) {
    throw AppError.notFound("PayrollRun");
  }
  return run;
}

export async function listPayrollRuns(organizationId: string, query: ListPayrollRunsQuery) {
  const where: Prisma.PayrollRunWhereInput = {
    organizationId,
    ...(query.status ? { status: query.status } : {}),
  };

  const [items, total] = await Promise.all([
    prisma.payrollRun.findMany({
      where,
      orderBy: { period: "desc" },
      skip: (query.page - 1) * query.pageSize,
      take: query.pageSize,
    }),
    prisma.payrollRun.count({ where }),
  ]);

  return { items, meta: { page: query.page, pageSize: query.pageSize, total } };
}

export async function createPayrollRun(organizationId: string, period: string, actorId: string) {
  try {
    return await prisma.$transaction(async (tx) => {
      const run = await tx.payrollRun.create({
        data: { organizationId, period, status: PayrollRunStatus.DRAFT },
      });

      await recordAudit(
        {
          organizationId,
          actorId,
          action: "PAYROLL_RUN_CREATED",
          resourceType: "PayrollRun",
          resourceId: run.id,
          metadata: { period },
        },
        tx,
      );

      return run;
    });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      throw AppError.conflict(
        "PAYROLL_RUN_ALREADY_EXISTS",
        `A payroll run for period ${period} already exists`,
      );
    }
    throw err;
  }
}

interface LockedPayrollRunRow {
  id: string;
  period: string;
  status: PayrollRunStatus;
}

// SELECT ... FOR UPDATE so calculate/approve/mark-paid on the same run can't
// race each other's state-machine guard (same pattern as leave/overtime/
// salary — HLD section 12's locking principle applied to payroll too).
async function lockPayrollRun(
  tx: Prisma.TransactionClient,
  organizationId: string,
  runId: string,
): Promise<LockedPayrollRunRow> {
  const rows = await tx.$queryRaw<LockedPayrollRunRow[]>`
    SELECT id, period, status FROM payroll_runs
    WHERE id = ${runId} AND organization_id = ${organizationId}
    FOR UPDATE
  `;
  const row = rows[0];
  if (!row) {
    throw AppError.notFound("PayrollRun");
  }
  return row;
}

// HLD section 13 payroll flow: validate eligibility -> load salary/OT/leave
// -> calculate -> validate -> persist snapshots. Re-runnable while DRAFT or
// CALCULATED (the state table's "review; recalculate before approval");
// locked out once APPROVED or PAID.
export async function calculatePayrollRun(organizationId: string, runId: string, actorId: string) {
  return prisma.$transaction(async (tx) => {
    const locked = await lockPayrollRun(tx, organizationId, runId);

    if (locked.status !== PayrollRunStatus.DRAFT && locked.status !== PayrollRunStatus.CALCULATED) {
      throw AppError.conflict(
        "INVALID_STATUS_TRANSITION",
        `Cannot calculate a payroll run in status ${locked.status}`,
      );
    }

    const { start, end } = periodToDateRange(locked.period);

    const employees = await tx.employee.findMany({
      where: { organizationId, status: "ACTIVE", joinDate: { lte: end } },
    });

    if (employees.length === 0) {
      throw AppError.businessRule(
        "NO_ELIGIBLE_EMPLOYEES",
        "No active employees are eligible for this payroll period",
      );
    }

    // Recalculation starts from a clean slate.
    await tx.payrollItem.deleteMany({ where: { payrollRunId: runId } });

    let grossTotal = 0;
    let netTotal = 0;
    let deductionsTotal = 0;

    for (const employee of employees) {
      const [salaryProfile, approvedOvertime, unpaidLeave] = await Promise.all([
        tx.salaryProfile.findFirst({
          where: {
            employeeId: employee.id,
            effectiveFrom: { lte: end },
            OR: [{ effectiveTo: null }, { effectiveTo: { gte: end } }],
          },
          orderBy: { effectiveFrom: "desc" },
        }),
        tx.overtimeRequest.findMany({
          where: { employeeId: employee.id, status: "APPROVED", workDate: { gte: start, lte: end } },
        }),
        tx.leaveRequest.findMany({
          where: {
            employeeId: employee.id,
            status: "APPROVED",
            startDate: { lte: end },
            endDate: { gte: start },
            leaveType: { paid: false },
          },
        }),
      ]);

      if (!salaryProfile) {
        throw AppError.businessRule(
          "SALARY_PROFILE_MISSING",
          `Employee ${employee.employeeNo} has no salary profile effective for period ${locked.period}`,
        );
      }

      const result = calculatePayrollItem({
        salaryProfile: {
          id: salaryProfile.id,
          basicSalary: salaryProfile.basicSalary.toNumber(),
          allowances: asAmountRecord(salaryProfile.allowances),
          deductions: asAmountRecord(salaryProfile.deductions),
          ...extractOtSettings(salaryProfile.otSettings),
        },
        approvedOvertime: approvedOvertime.map((ot) => ({
          id: ot.id,
          hours: ot.hours.toNumber(),
          multiplier: ot.multiplier.toNumber(),
        })),
        unpaidLeave: unpaidLeave.map((leave) => ({ id: leave.id, days: leave.days.toNumber() })),
      });

      await tx.payrollItem.create({
        data: {
          payrollRunId: runId,
          employeeId: employee.id,
          snapshotInput: result.snapshotInput as Prisma.InputJsonValue,
          earnings: result.earnings,
          deductions: result.deductions,
          gross: result.gross,
          net: result.net,
        },
      });

      grossTotal += result.gross;
      netTotal += result.net;
      deductionsTotal += result.deductions;
    }

    const totals = {
      employeeCount: employees.length,
      grossTotal: round2(grossTotal),
      netTotal: round2(netTotal),
      deductionsTotal: round2(deductionsTotal),
    };

    await tx.payrollRun.update({
      where: { id: runId },
      data: { status: PayrollRunStatus.CALCULATED, totals: totals as Prisma.InputJsonValue },
    });

    await recordAudit(
      {
        organizationId,
        actorId,
        action: "PAYROLL_RUN_CALCULATED",
        resourceType: "PayrollRun",
        resourceId: runId,
        metadata: totals,
      },
      tx,
    );

    return reloadPayrollRun(tx, runId);
  });
}

export async function approvePayrollRun(organizationId: string, runId: string, actorId: string) {
  return prisma.$transaction(async (tx) => {
    const locked = await lockPayrollRun(tx, organizationId, runId);

    if (locked.status !== PayrollRunStatus.CALCULATED) {
      throw AppError.conflict(
        "INVALID_STATUS_TRANSITION",
        `Cannot approve a payroll run in status ${locked.status}`,
      );
    }

    await tx.payrollRun.update({
      where: { id: runId },
      data: { status: PayrollRunStatus.APPROVED, approvedBy: actorId, approvedAt: new Date() },
    });

    await recordAudit(
      {
        organizationId,
        actorId,
        action: "PAYROLL_RUN_APPROVED",
        resourceType: "PayrollRun",
        resourceId: runId,
        metadata: {},
      },
      tx,
    );

    return reloadPayrollRun(tx, runId);
  });
}

export async function markPayrollRunPaid(organizationId: string, runId: string, actorId: string) {
  return prisma.$transaction(async (tx) => {
    const locked = await lockPayrollRun(tx, organizationId, runId);

    if (locked.status !== PayrollRunStatus.APPROVED) {
      throw AppError.conflict(
        "INVALID_STATUS_TRANSITION",
        `Cannot mark a payroll run in status ${locked.status} as paid`,
      );
    }

    await tx.payrollRun.update({
      where: { id: runId },
      data: { status: PayrollRunStatus.PAID, paidAt: new Date() },
    });

    await recordAudit(
      {
        organizationId,
        actorId,
        action: "PAYROLL_RUN_MARKED_PAID",
        resourceType: "PayrollRun",
        resourceId: runId,
        metadata: {},
      },
      tx,
    );

    return reloadPayrollRun(tx, runId);
  });
}
