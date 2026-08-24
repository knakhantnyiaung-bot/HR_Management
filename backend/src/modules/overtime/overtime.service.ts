import { Prisma, RequestStatus } from "@prisma/client";
import { prisma } from "@database/prisma";
import { AppError } from "@common/errors/AppError";
import { recordAudit } from "@modules/audit/audit.service";
import { getEmployeeByUserId } from "@modules/employees/employees.service";
import type {
  CreateOvertimeRequestInput,
  ListOvertimeRequestsQuery,
} from "@modules/overtime/overtime.schema";

const OVERTIME_REQUEST_INCLUDE = {
  employee: {
    select: { id: true, employeeNo: true, user: { select: { email: true } } },
  },
} satisfies Prisma.OvertimeRequestInclude;

// HLD Appendix C overtime state machine: PENDING -> APPROVED -> (payroll
// input) / REJECTED / CANCELLED. Unlike leave, APPROVED is terminal here —
// once overtime is approved it's eligible for payroll and isn't reversed
// through this ordinary endpoint (HLD section 12: "Only APPROVED OT ...
// affect payroll").
const ALLOWED_TRANSITIONS: Record<RequestStatus, RequestStatus[]> = {
  PENDING: [RequestStatus.APPROVED, RequestStatus.REJECTED, RequestStatus.CANCELLED],
  APPROVED: [],
  REJECTED: [],
  CANCELLED: [],
};

function calculateHours(startTime: Date, endTime: Date): number {
  const msPerHour = 60 * 60 * 1000;
  return Math.round(((endTime.getTime() - startTime.getTime()) / msPerHour) * 100) / 100;
}

export async function createOvertimeRequest(
  organizationId: string,
  userId: string,
  input: CreateOvertimeRequestInput,
) {
  const employee = await getEmployeeByUserId(organizationId, userId);

  // HLD section 12: "Reject overlapping requests according to policy."
  const overlapping = await prisma.overtimeRequest.findFirst({
    where: {
      employeeId: employee.id,
      status: { in: [RequestStatus.PENDING, RequestStatus.APPROVED] },
      startTime: { lt: input.endTime },
      endTime: { gt: input.startTime },
    },
  });
  if (overlapping) {
    throw AppError.conflict(
      "OVERTIME_OVERLAP",
      "This request overlaps an existing pending or approved overtime request",
    );
  }

  return prisma.overtimeRequest.create({
    data: {
      employeeId: employee.id,
      workDate: input.workDate,
      startTime: input.startTime,
      endTime: input.endTime,
      hours: calculateHours(input.startTime, input.endTime),
      ...(input.multiplier !== undefined ? { multiplier: input.multiplier } : {}),
      status: RequestStatus.PENDING,
    },
    include: OVERTIME_REQUEST_INCLUDE,
  });
}

export async function listOvertimeRequests(
  organizationId: string,
  requester: { userId: string; role: "SUPER_ADMIN" | "HR_ADMIN" | "EMPLOYEE" },
  query: ListOvertimeRequestsQuery,
) {
  const where: Prisma.OvertimeRequestWhereInput = { employee: { organizationId } };

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
    prisma.overtimeRequest.findMany({
      where,
      include: OVERTIME_REQUEST_INCLUDE,
      orderBy: { createdAt: "desc" },
      skip: (query.page - 1) * query.pageSize,
      take: query.pageSize,
    }),
    prisma.overtimeRequest.count({ where }),
  ]);

  return { items, meta: { page: query.page, pageSize: query.pageSize, total } };
}

interface LockedOvertimeRequestRow {
  id: string;
  employeeId: string;
  status: RequestStatus;
}

// SELECT ... FOR UPDATE so two concurrent decisions on the same request
// can't both observe PENDING and race the state-machine guard below (HLD
// section 12: "Use transactions/locking/versioning to prevent double
// consumption.")
async function lockOvertimeRequest(
  tx: Prisma.TransactionClient,
  organizationId: string,
  requestId: string,
): Promise<LockedOvertimeRequestRow> {
  const rows = await tx.$queryRaw<LockedOvertimeRequestRow[]>`
    SELECT o.id, o.employee_id AS "employeeId", o.status
    FROM overtime_requests o
    INNER JOIN employees e ON e.id = o.employee_id
    WHERE o.id = ${requestId} AND e.organization_id = ${organizationId}
    FOR UPDATE
  `;
  const row = rows[0];
  if (!row) {
    throw AppError.notFound("OvertimeRequest");
  }
  return row;
}

async function transitionOvertimeRequest(
  organizationId: string,
  requestId: string,
  target: RequestStatus,
  actorId: string,
  action: string,
  restrictToEmployeeId?: string,
) {
  return prisma.$transaction(async (tx) => {
    const locked = await lockOvertimeRequest(tx, organizationId, requestId);

    if (restrictToEmployeeId && locked.employeeId !== restrictToEmployeeId) {
      throw AppError.forbidden("You may only act on your own overtime request");
    }

    if (!ALLOWED_TRANSITIONS[locked.status].includes(target)) {
      throw AppError.conflict(
        "INVALID_STATUS_TRANSITION",
        `Cannot transition overtime request from ${locked.status} to ${target}`,
      );
    }

    const updated = await tx.overtimeRequest.update({
      where: { id: requestId },
      data:
        target === RequestStatus.CANCELLED
          ? { status: target }
          // approvedBy/approvedAt double as "decided by/at" for reject too —
          // the schema has no separate rejectedBy column.
          : { status: target, approvedBy: actorId, approvedAt: new Date() },
      include: OVERTIME_REQUEST_INCLUDE,
    });

    await recordAudit(
      {
        organizationId,
        actorId,
        action,
        resourceType: "OvertimeRequest",
        resourceId: requestId,
        metadata: { from: locked.status, to: target },
      },
      tx,
    );

    return updated;
  });
}

export const approveOvertimeRequest = (organizationId: string, requestId: string, actorId: string) =>
  transitionOvertimeRequest(
    organizationId,
    requestId,
    RequestStatus.APPROVED,
    actorId,
    "OVERTIME_REQUEST_APPROVED",
  );

export const rejectOvertimeRequest = (organizationId: string, requestId: string, actorId: string) =>
  transitionOvertimeRequest(
    organizationId,
    requestId,
    RequestStatus.REJECTED,
    actorId,
    "OVERTIME_REQUEST_REJECTED",
  );

export const cancelOvertimeRequest = (
  organizationId: string,
  requestId: string,
  actorId: string,
  restrictToEmployeeId?: string,
) =>
  transitionOvertimeRequest(
    organizationId,
    requestId,
    RequestStatus.CANCELLED,
    actorId,
    "OVERTIME_REQUEST_CANCELLED",
    restrictToEmployeeId,
  );
