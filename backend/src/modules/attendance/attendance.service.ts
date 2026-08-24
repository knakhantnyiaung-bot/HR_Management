import type { Prisma } from "@prisma/client";
import { prisma } from "@database/prisma";
import { AppError } from "@common/errors/AppError";
import { recordAudit } from "@modules/audit/audit.service";
import type {
  CorrectAttendanceInput,
  ListAttendanceQuery,
} from "@modules/attendance/attendance.schema";

const ATTENDANCE_INCLUDE = {
  employee: {
    select: {
      id: true,
      employeeNo: true,
      user: { select: { email: true } },
    },
  },
} satisfies Prisma.AttendanceRecordInclude;

// HLD section 11: "Business date uses organization timezone." "en-CA" formats
// as YYYY-MM-DD, which is exactly what we need for a @db.Date column.
async function getBusinessDate(organizationId: string, at: Date): Promise<Date> {
  const organization = await prisma.organization.findUniqueOrThrow({
    where: { id: organizationId },
    select: { timezone: true },
  });
  const isoDate = new Intl.DateTimeFormat("en-CA", { timeZone: organization.timezone }).format(at);
  return new Date(`${isoDate}T00:00:00.000Z`);
}

async function getOwnEmployee(organizationId: string, userId: string) {
  const employee = await prisma.employee.findFirst({ where: { userId, organizationId } });
  if (!employee) {
    throw AppError.notFound("Employee");
  }
  return employee;
}

async function getOwnActiveEmployee(organizationId: string, userId: string) {
  const employee = await getOwnEmployee(organizationId, userId);
  if (employee.status !== "ACTIVE") {
    throw AppError.businessRule(
      "EMPLOYEE_NOT_ACTIVE",
      "Only active employees can record attendance",
    );
  }
  return employee;
}

export async function checkIn(organizationId: string, userId: string) {
  const employee = await getOwnActiveEmployee(organizationId, userId);

  const openSession = await prisma.attendanceRecord.findFirst({
    where: { employeeId: employee.id, checkOut: null },
  });
  if (openSession) {
    throw AppError.conflict(
      "ATTENDANCE_ALREADY_OPEN",
      "You already have an open attendance session; check out first",
    );
  }

  const now = new Date();
  const workDate = await getBusinessDate(organizationId, now);

  return prisma.attendanceRecord.create({
    data: { organizationId, employeeId: employee.id, workDate, checkIn: now },
    include: ATTENDANCE_INCLUDE,
  });
}

export async function checkOut(organizationId: string, userId: string) {
  const employee = await getOwnActiveEmployee(organizationId, userId);

  const openSession = await prisma.attendanceRecord.findFirst({
    where: { employeeId: employee.id, checkOut: null },
  });
  if (!openSession) {
    throw AppError.conflict(
      "NO_OPEN_ATTENDANCE_SESSION",
      "There is no open attendance session to check out of",
    );
  }

  const now = new Date();
  const workingMinutes = Math.round((now.getTime() - openSession.checkIn.getTime()) / 60000);

  return prisma.attendanceRecord.update({
    where: { id: openSession.id },
    data: { checkOut: now, workingMinutes },
    include: ATTENDANCE_INCLUDE,
  });
}

export async function listAttendance(
  organizationId: string,
  requester: { userId: string; role: "SUPER_ADMIN" | "HR_ADMIN" | "EMPLOYEE" },
  query: ListAttendanceQuery,
) {
  const where: Prisma.AttendanceRecordWhereInput = { organizationId };

  if (requester.role === "EMPLOYEE") {
    // No ACTIVE requirement here — an inactive/terminated employee can still
    // see their own history, just not record new attendance (see checkIn).
    const employee = await getOwnEmployee(organizationId, requester.userId);
    where.employeeId = employee.id;
  } else if (query.employeeId) {
    where.employeeId = query.employeeId;
  }

  if (query.from || query.to) {
    where.workDate = {
      ...(query.from ? { gte: query.from } : {}),
      ...(query.to ? { lte: query.to } : {}),
    };
  }

  const [items, total] = await Promise.all([
    prisma.attendanceRecord.findMany({
      where,
      include: ATTENDANCE_INCLUDE,
      orderBy: { workDate: "desc" },
      skip: (query.page - 1) * query.pageSize,
      take: query.pageSize,
    }),
    prisma.attendanceRecord.count({ where }),
  ]);

  return { items, meta: { page: query.page, pageSize: query.pageSize, total } };
}

export async function correctAttendance(
  organizationId: string,
  recordId: string,
  input: CorrectAttendanceInput,
  actorId: string,
) {
  const existing = await prisma.attendanceRecord.findFirst({
    where: { id: recordId, organizationId },
  });
  if (!existing) {
    throw AppError.notFound("AttendanceRecord");
  }

  const nextCheckIn = input.checkIn ?? existing.checkIn;
  const nextCheckOut = input.checkOut ?? existing.checkOut;

  if (nextCheckOut && nextCheckOut <= nextCheckIn) {
    throw AppError.badRequest("INVALID_TIME_RANGE", "checkOut must be after checkIn");
  }

  const workingMinutes = nextCheckOut
    ? Math.round((nextCheckOut.getTime() - nextCheckIn.getTime()) / 60000)
    : null;

  return prisma.$transaction(async (tx) => {
    const updated = await tx.attendanceRecord.update({
      where: { id: recordId },
      data: {
        checkIn: nextCheckIn,
        checkOut: nextCheckOut,
        workingMinutes,
        correctedBy: actorId,
        correctionNote: input.reason,
      },
      include: ATTENDANCE_INCLUDE,
    });

    await recordAudit(
      {
        organizationId,
        actorId,
        action: "ATTENDANCE_CORRECTED",
        resourceType: "AttendanceRecord",
        resourceId: recordId,
        metadata: {
          reason: input.reason,
          before: { checkIn: existing.checkIn, checkOut: existing.checkOut },
          after: { checkIn: nextCheckIn, checkOut: nextCheckOut },
        },
      },
      tx,
    );

    return updated;
  });
}
