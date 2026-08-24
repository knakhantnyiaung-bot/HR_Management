import { Prisma, RequestStatus } from "@prisma/client";
import { prisma } from "@database/prisma";
import { AppError } from "@common/errors/AppError";
import { recordAudit } from "@modules/audit/audit.service";
import { getEmployeeByUserId } from "@modules/employees/employees.service";
import type {
  CreateLeaveRequestInput,
  CreateLeaveTypeInput,
  GrantLeaveBalanceInput,
  ListLeaveBalancesQuery,
  ListLeaveRequestsQuery,
} from "@modules/leave/leave.schema";

const LEAVE_REQUEST_INCLUDE = {
  employee: {
    select: { id: true, employeeNo: true, user: { select: { email: true } } },
  },
  leaveType: { select: { id: true, name: true, paid: true } },
} satisfies Prisma.LeaveRequestInclude;

// HLD Appendix C leave state machine: PENDING -> APPROVED/REJECTED/CANCELLED,
// APPROVED -> CANCELLED.
const ALLOWED_TRANSITIONS: Record<RequestStatus, RequestStatus[]> = {
  PENDING: [RequestStatus.APPROVED, RequestStatus.REJECTED, RequestStatus.CANCELLED],
  APPROVED: [RequestStatus.CANCELLED],
  REJECTED: [],
  CANCELLED: [],
};

function calculateDays(startDate: Date, endDate: Date): number {
  const msPerDay = 24 * 60 * 60 * 1000;
  return Math.round((endDate.getTime() - startDate.getTime()) / msPerDay) + 1;
}

// Balances are tracked annually by the leave's start-date year. A more
// granular policy (e.g. fiscal year) is a config concern for later sprints.
function periodFor(date: Date): string {
  return String(date.getUTCFullYear());
}

// ---------------------------------------------------------------------------
// Leave types
// ---------------------------------------------------------------------------

export async function listLeaveTypes(organizationId: string) {
  return prisma.leaveType.findMany({ where: { organizationId }, orderBy: { name: "asc" } });
}

export async function createLeaveType(organizationId: string, input: CreateLeaveTypeInput) {
  return prisma.leaveType.create({
    data: {
      organizationId,
      name: input.name,
      paid: input.paid,
      policySettings: input.policySettings as Prisma.InputJsonValue | undefined,
    },
  });
}

// ---------------------------------------------------------------------------
// Leave balances
// ---------------------------------------------------------------------------

export async function listLeaveBalances(
  organizationId: string,
  requester: { userId: string; role: "SUPER_ADMIN" | "HR_ADMIN" | "EMPLOYEE" },
  query: ListLeaveBalancesQuery,
) {
  const where: Prisma.LeaveBalanceWhereInput = { employee: { organizationId } };

  if (requester.role === "EMPLOYEE") {
    const employee = await getEmployeeByUserId(organizationId, requester.userId);
    where.employeeId = employee.id;
  } else if (query.employeeId) {
    where.employeeId = query.employeeId;
  }

  if (query.period) {
    where.period = query.period;
  }

  return prisma.leaveBalance.findMany({
    where,
    include: { leaveType: { select: { id: true, name: true, paid: true } } },
    orderBy: [{ period: "desc" }, { leaveType: { name: "asc" } }],
  });
}

export async function grantLeaveBalance(
  organizationId: string,
  input: GrantLeaveBalanceInput,
  actorId: string,
) {
  const [employee, leaveType] = await Promise.all([
    prisma.employee.findFirst({ where: { id: input.employeeId, organizationId } }),
    prisma.leaveType.findFirst({ where: { id: input.leaveTypeId, organizationId } }),
  ]);
  if (!employee) {
    throw AppError.badRequest("INVALID_EMPLOYEE", "Employee not found in this organization");
  }
  if (!leaveType) {
    throw AppError.badRequest("INVALID_LEAVE_TYPE", "Leave type not found in this organization");
  }

  return prisma.$transaction(async (tx) => {
    const key = {
      employeeId_leaveTypeId_period: {
        employeeId: input.employeeId,
        leaveTypeId: input.leaveTypeId,
        period: input.period,
      },
    };
    const existing = await tx.leaveBalance.findUnique({ where: key });
    const used = existing ? existing.used.toNumber() : 0;
    const remaining = input.entitled - used;

    const balance = await tx.leaveBalance.upsert({
      where: key,
      update: { entitled: input.entitled, remaining },
      create: {
        employeeId: input.employeeId,
        leaveTypeId: input.leaveTypeId,
        period: input.period,
        entitled: input.entitled,
        used: 0,
        remaining,
      },
    });

    await recordAudit(
      {
        organizationId,
        actorId,
        action: "LEAVE_BALANCE_GRANTED",
        resourceType: "LeaveBalance",
        resourceId: balance.id,
        metadata: {
          employeeId: input.employeeId,
          leaveTypeId: input.leaveTypeId,
          period: input.period,
          entitled: input.entitled,
        },
      },
      tx,
    );

    return balance;
  });
}

// ---------------------------------------------------------------------------
// Leave requests
// ---------------------------------------------------------------------------

export async function createLeaveRequest(
  organizationId: string,
  userId: string,
  input: CreateLeaveRequestInput,
) {
  const employee = await getEmployeeByUserId(organizationId, userId);

  const leaveType = await prisma.leaveType.findFirst({
    where: { id: input.leaveTypeId, organizationId },
  });
  if (!leaveType) {
    throw AppError.badRequest("INVALID_LEAVE_TYPE", "Leave type not found in this organization");
  }

  // HLD section 12: "Reject overlapping requests according to policy."
  const overlapping = await prisma.leaveRequest.findFirst({
    where: {
      employeeId: employee.id,
      status: { in: [RequestStatus.PENDING, RequestStatus.APPROVED] },
      startDate: { lte: input.endDate },
      endDate: { gte: input.startDate },
    },
  });
  if (overlapping) {
    throw AppError.conflict(
      "LEAVE_OVERLAP",
      "This request overlaps an existing pending or approved leave request",
    );
  }

  return prisma.leaveRequest.create({
    data: {
      employeeId: employee.id,
      leaveTypeId: input.leaveTypeId,
      startDate: input.startDate,
      endDate: input.endDate,
      days: calculateDays(input.startDate, input.endDate),
      reason: input.reason,
      status: RequestStatus.PENDING,
    },
    include: LEAVE_REQUEST_INCLUDE,
  });
}

export async function listLeaveRequests(
  organizationId: string,
  requester: { userId: string; role: "SUPER_ADMIN" | "HR_ADMIN" | "EMPLOYEE" },
  query: ListLeaveRequestsQuery,
) {
  const where: Prisma.LeaveRequestWhereInput = { employee: { organizationId } };

  if (requester.role === "EMPLOYEE") {
    const employee = await getEmployeeByUserId(organizationId, requester.userId);
    where.employeeId = employee.id;
  } else if (query.employeeId) {
    where.employeeId = query.employeeId;
  }

  if (query.status) {
    where.status = query.status;
  }

  const [items, total] = await Promise.all([
    prisma.leaveRequest.findMany({
      where,
      include: LEAVE_REQUEST_INCLUDE,
      orderBy: { createdAt: "desc" },
      skip: (query.page - 1) * query.pageSize,
      take: query.pageSize,
    }),
    prisma.leaveRequest.count({ where }),
  ]);

  return { items, meta: { page: query.page, pageSize: query.pageSize, total } };
}

export async function getLeaveRequestById(organizationId: string, requestId: string) {
  const request = await prisma.leaveRequest.findFirst({
    where: { id: requestId, employee: { organizationId } },
    include: LEAVE_REQUEST_INCLUDE,
  });
  if (!request) {
    throw AppError.notFound("LeaveRequest");
  }
  return request;
}

interface LockedLeaveRequestRow {
  id: string;
  employeeId: string;
  leaveTypeId: string;
  startDate: Date;
  days: Prisma.Decimal;
  status: RequestStatus;
}

// Locks the leave_request row (SELECT ... FOR UPDATE) so two concurrent
// decisions on the *same* request can't both observe PENDING and race the
// state-machine guard below (HLD section 12: "Use transactions/locking/
// versioning to prevent double consumption.")
async function lockLeaveRequest(
  tx: Prisma.TransactionClient,
  organizationId: string,
  requestId: string,
): Promise<LockedLeaveRequestRow> {
  const rows = await tx.$queryRaw<LockedLeaveRequestRow[]>`
    SELECT lr.id, lr.employee_id AS "employeeId", lr.leave_type_id AS "leaveTypeId",
           lr.start_date AS "startDate", lr.days, lr.status
    FROM leave_requests lr
    INNER JOIN employees e ON e.id = lr.employee_id
    WHERE lr.id = ${requestId} AND e.organization_id = ${organizationId}
    FOR UPDATE
  `;
  const row = rows[0];
  if (!row) {
    throw AppError.notFound("LeaveRequest");
  }
  return row;
}

export async function approveLeaveRequest(
  organizationId: string,
  requestId: string,
  actorId: string,
) {
  return prisma.$transaction(async (tx) => {
    const locked = await lockLeaveRequest(tx, organizationId, requestId);

    if (!ALLOWED_TRANSITIONS[locked.status].includes(RequestStatus.APPROVED)) {
      throw AppError.conflict(
        "INVALID_STATUS_TRANSITION",
        `Cannot transition leave request from ${locked.status} to APPROVED`,
      );
    }

    const leaveType = await tx.leaveType.findUniqueOrThrow({ where: { id: locked.leaveTypeId } });
    const days = locked.days.toNumber();

    if (leaveType.paid) {
      const period = periodFor(locked.startDate);

      // Locking the balance row too closes the race where two *different*
      // pending requests draw from the same pool concurrently — without
      // this, both could read "remaining: 5" before either writes back.
      const balanceRows = await tx.$queryRaw<Array<{ id: string; remaining: Prisma.Decimal }>>`
        SELECT id, remaining FROM leave_balances
        WHERE employee_id = ${locked.employeeId}
          AND leave_type_id = ${locked.leaveTypeId}
          AND period = ${period}
        FOR UPDATE
      `;
      const balanceRow = balanceRows[0];
      const remaining = balanceRow ? balanceRow.remaining.toNumber() : 0;

      if (remaining < days) {
        throw AppError.businessRule("LEAVE_BALANCE_INSUFFICIENT", "Insufficient leave balance");
      }

      await tx.leaveBalance.update({
        where: { id: balanceRow!.id },
        data: { used: { increment: days }, remaining: { decrement: days } },
      });
    }

    const updated = await tx.leaveRequest.update({
      where: { id: requestId },
      data: { status: RequestStatus.APPROVED, approvedBy: actorId, approvedAt: new Date() },
      include: LEAVE_REQUEST_INCLUDE,
    });

    await recordAudit(
      {
        organizationId,
        actorId,
        action: "LEAVE_REQUEST_APPROVED",
        resourceType: "LeaveRequest",
        resourceId: requestId,
        metadata: { days, leaveTypeId: locked.leaveTypeId },
      },
      tx,
    );

    return updated;
  });
}

export async function rejectLeaveRequest(
  organizationId: string,
  requestId: string,
  actorId: string,
) {
  return prisma.$transaction(async (tx) => {
    const locked = await lockLeaveRequest(tx, organizationId, requestId);

    if (!ALLOWED_TRANSITIONS[locked.status].includes(RequestStatus.REJECTED)) {
      throw AppError.conflict(
        "INVALID_STATUS_TRANSITION",
        `Cannot transition leave request from ${locked.status} to REJECTED`,
      );
    }

    const updated = await tx.leaveRequest.update({
      where: { id: requestId },
      // approvedBy/approvedAt double as "decided by/at" — the schema has no
      // separate rejectedBy column and a reject is still a one-time decision.
      data: { status: RequestStatus.REJECTED, approvedBy: actorId, approvedAt: new Date() },
      include: LEAVE_REQUEST_INCLUDE,
    });

    await recordAudit(
      {
        organizationId,
        actorId,
        action: "LEAVE_REQUEST_REJECTED",
        resourceType: "LeaveRequest",
        resourceId: requestId,
        metadata: {},
      },
      tx,
    );

    return updated;
  });
}

export async function cancelLeaveRequest(
  organizationId: string,
  requestId: string,
  actorId: string,
  // When set (an Employee caller), the ownership check happens against the
  // same locked row instead of a separate unlocked read beforehand, which
  // would otherwise leave a TOCTOU gap between the check and the mutation.
  restrictToEmployeeId?: string,
) {
  return prisma.$transaction(async (tx) => {
    const locked = await lockLeaveRequest(tx, organizationId, requestId);

    if (restrictToEmployeeId && locked.employeeId !== restrictToEmployeeId) {
      throw AppError.forbidden("You may only cancel your own leave request");
    }

    if (!ALLOWED_TRANSITIONS[locked.status].includes(RequestStatus.CANCELLED)) {
      throw AppError.conflict(
        "INVALID_STATUS_TRANSITION",
        `Cannot transition leave request from ${locked.status} to CANCELLED`,
      );
    }

    if (locked.status === RequestStatus.APPROVED) {
      const leaveType = await tx.leaveType.findUniqueOrThrow({ where: { id: locked.leaveTypeId } });
      if (leaveType.paid) {
        const period = periodFor(locked.startDate);
        const days = locked.days.toNumber();

        const balanceRows = await tx.$queryRaw<Array<{ id: string }>>`
          SELECT id FROM leave_balances
          WHERE employee_id = ${locked.employeeId}
            AND leave_type_id = ${locked.leaveTypeId}
            AND period = ${period}
          FOR UPDATE
        `;
        const balanceRow = balanceRows[0];
        // A missing balance row here would mean it was consumed then
        // deleted out of band — nothing to restore, and it can't happen
        // through this module's own API.
        if (balanceRow) {
          await tx.leaveBalance.update({
            where: { id: balanceRow.id },
            data: { used: { decrement: days }, remaining: { increment: days } },
          });
        }
      }
    }

    const updated = await tx.leaveRequest.update({
      where: { id: requestId },
      data: { status: RequestStatus.CANCELLED },
      include: LEAVE_REQUEST_INCLUDE,
    });

    await recordAudit(
      {
        organizationId,
        actorId,
        action: "LEAVE_REQUEST_CANCELLED",
        resourceType: "LeaveRequest",
        resourceId: requestId,
        metadata: { fromStatus: locked.status },
      },
      tx,
    );

    return updated;
  });
}
