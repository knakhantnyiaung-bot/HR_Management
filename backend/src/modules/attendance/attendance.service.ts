import { LocationPolicy, type LocationSource, type Prisma } from "@prisma/client";
import { prisma } from "@database/prisma";
import type { AuthContext } from "@common/auth/requireAuth";
import { AppError } from "@common/errors/AppError";
import { recordAudit } from "@modules/audit/audit.service";
import { getEmployeeByUserId } from "@modules/employees/employees.service";
import { enforceGeofencePolicy } from "@modules/geofence/geofence.service";
import type {
  CorrectAttendanceInput,
  ListAttendanceQuery,
  RawAttendanceLocation,
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
// Exported for the dashboard module, which needs the same "today" definition
// for its present-today/on-leave-today aggregates.
export async function getBusinessDate(organizationId: string, at: Date): Promise<Date> {
  const organization = await prisma.organization.findUniqueOrThrow({
    where: { id: organizationId },
    select: { timezone: true },
  });
  const isoDate = new Intl.DateTimeFormat("en-CA", { timeZone: organization.timezone }).format(at);
  return new Date(`${isoDate}T00:00:00.000Z`);
}

interface SanitizedLocation {
  lat: number | null;
  lng: number | null;
  accuracyMeters: number | null;
  source: LocationSource;
}

const NO_LOCATION: SanitizedLocation = {
  lat: null,
  lng: null,
  accuracyMeters: null,
  source: "UNAVAILABLE",
};

// ATT-09/ATT-11 (Handbook v1.1): coordinates are optional and validated for
// shape only — an out-of-range or malformed value is silently dropped, it
// never fails the check-in/check-out request.
function sanitizeLocation(raw: RawAttendanceLocation): SanitizedLocation {
  const { lat, lng, accuracyMeters } = raw;
  const validLat = typeof lat === "number" && Number.isFinite(lat) && lat >= -90 && lat <= 90;
  const validLng = typeof lng === "number" && Number.isFinite(lng) && lng >= -180 && lng <= 180;
  if (!validLat || !validLng) {
    return NO_LOCATION;
  }

  const validAccuracy =
    typeof accuracyMeters === "number" && Number.isFinite(accuracyMeters) && accuracyMeters >= 0;

  return {
    lat,
    lng,
    accuracyMeters: validAccuracy ? Math.round(accuracyMeters) : null,
    source: "GPS",
  };
}

// ATT-12 / Sprint 2 GEO-01: NONE discards submitted coordinates entirely
// (old locationCaptureEnabled=false); LOG_ONLY and GEOFENCE_ENFORCED both
// capture them (old locationCaptureEnabled=true plus the new enforced mode).
async function resolveLocation(
  organizationId: string,
  raw: RawAttendanceLocation,
): Promise<SanitizedLocation> {
  const organization = await prisma.organization.findUniqueOrThrow({
    where: { id: organizationId },
    select: { locationPolicy: true },
  });
  if (organization.locationPolicy === LocationPolicy.NONE) {
    return NO_LOCATION;
  }
  return sanitizeLocation(raw);
}

async function getOwnActiveEmployee(organizationId: string, userId: string) {
  const employee = await getEmployeeByUserId(organizationId, userId);
  if (employee.status !== "ACTIVE") {
    throw AppError.businessRule(
      "EMPLOYEE_NOT_ACTIVE",
      "Only active employees can record attendance",
    );
  }
  return employee;
}

export async function checkIn(
  organizationId: string,
  userId: string,
  rawLocation: RawAttendanceLocation = {},
) {
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
  const location = await resolveLocation(organizationId, rawLocation);

  // Sprint 2 HLD Sec 11 — evaluated before any AttendanceRecord write; a
  // rejection here means no attendance row is ever created (GEO-08).
  // Audited separately from the (nonexistent) record it would have been.
  try {
    await enforceGeofencePolicy(organizationId, employee.workModel, {
      lat: location.lat,
      lng: location.lng,
    });
  } catch (err) {
    if (err instanceof AppError) {
      await recordAudit({
        organizationId,
        actorId: userId,
        action: "ATTENDANCE_CHECKIN_REJECTED_GEOFENCE",
        resourceType: "Employee",
        resourceId: employee.id,
        metadata: { code: err.code, lat: location.lat, lng: location.lng },
      });
    }
    throw err;
  }

  return prisma.attendanceRecord.create({
    data: {
      organizationId,
      employeeId: employee.id,
      workDate,
      checkIn: now,
      checkInLat: location.lat,
      checkInLng: location.lng,
      checkInAccuracyM: location.accuracyMeters,
      locationSource: location.source,
    },
    include: ATTENDANCE_INCLUDE,
  });
}

export async function checkOut(
  organizationId: string,
  userId: string,
  rawLocation: RawAttendanceLocation = {},
) {
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
  const location = await resolveLocation(organizationId, rawLocation);
  // locationSource reflects whether GPS was captured at either end of the
  // session — check-in and check-out can each independently have or lack it.
  const locationSource: LocationSource =
    location.source === "GPS" || openSession.locationSource === "GPS" ? "GPS" : "UNAVAILABLE";

  return prisma.attendanceRecord.update({
    where: { id: openSession.id },
    data: {
      checkOut: now,
      workingMinutes,
      checkOutLat: location.lat,
      checkOutLng: location.lng,
      checkOutAccuracyM: location.accuracyMeters,
      locationSource,
    },
    include: ATTENDANCE_INCLUDE,
  });
}

export async function listAttendance(
  organizationId: string,
  requester: { userId: string; role: AuthContext["role"] },
  query: ListAttendanceQuery,
) {
  const where: Prisma.AttendanceRecordWhereInput = { organizationId };

  // Sprint 2: HIRING_MANAGER must not fall into the HR branch below just
  // because it isn't literally "EMPLOYEE" — only HR_ADMIN/SUPER_ADMIN get
  // unrestricted attendance visibility; every other role sees its own only.
  if (requester.role !== "HR_ADMIN" && requester.role !== "SUPER_ADMIN") {
    // No ACTIVE requirement here — an inactive/terminated employee can still
    // see their own history, just not record new attendance (see checkIn).
    const employee = await getEmployeeByUserId(organizationId, requester.userId);
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
