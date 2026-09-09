import { CourseStatus, EmployeeStatus, Prisma } from "@prisma/client";
import { prisma } from "@database/prisma";
import type { AuthContext } from "@common/auth/requireAuth";
import { AppError } from "@common/errors/AppError";
import { recordAudit } from "@modules/audit/audit.service";
import { getEmployeeByUserId } from "@modules/employees/employees.service";
import type {
  CreateCourseInput,
  ListCoursesQuery,
  ListEnrollmentsQuery,
  UpdateCourseInput,
} from "@modules/courses/courses.schema";

// ---------------------------------------------------------------------------
// Catalog — LMS-01/02
// ---------------------------------------------------------------------------

export async function listCourses(organizationId: string, query: ListCoursesQuery) {
  const where: Prisma.CourseWhereInput = {
    organizationId,
    ...(query.status ? { status: query.status } : {}),
    ...(query.category ? { category: query.category } : {}),
  };

  const [items, total] = await Promise.all([
    prisma.course.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (query.page - 1) * query.pageSize,
      take: query.pageSize,
    }),
    prisma.course.count({ where }),
  ]);

  return { items, meta: { page: query.page, pageSize: query.pageSize, total } };
}

// LMS-01 — HR Admin/Super Admin only (enforced at the route level).
export async function createCourse(organizationId: string, input: CreateCourseInput, actorId: string) {
  return prisma.$transaction(async (tx) => {
    const course = await tx.course.create({ data: { organizationId, ...input } });

    await recordAudit(
      {
        organizationId,
        actorId,
        action: "COURSE_CREATED",
        resourceType: "Course",
        resourceId: course.id,
        metadata: { title: input.title },
      },
      tx,
    );

    return course;
  });
}

async function getOrgCourse(organizationId: string, courseId: string) {
  const course = await prisma.course.findFirst({ where: { id: courseId, organizationId } });
  if (!course) {
    throw AppError.notFound("Course");
  }
  return course;
}

export async function updateCourse(
  organizationId: string,
  courseId: string,
  input: UpdateCourseInput,
  actorId: string,
) {
  await getOrgCourse(organizationId, courseId);

  return prisma.$transaction(async (tx) => {
    const updated = await tx.course.update({ where: { id: courseId }, data: input });

    await recordAudit(
      {
        organizationId,
        actorId,
        action: "COURSE_UPDATED",
        resourceType: "Course",
        resourceId: courseId,
        metadata: input,
      },
      tx,
    );

    return updated;
  });
}

// ---------------------------------------------------------------------------
// Enrollments — LMS-03..07
// ---------------------------------------------------------------------------

const ENROLLMENT_INCLUDE = {
  course: { select: { id: true, title: true, externalUrl: true, mandatory: true } },
  employee: {
    select: { id: true, employeeNo: true, user: { select: { email: true } } },
  },
} satisfies Prisma.CourseEnrollmentInclude;

// LMS-03 — self-enrollment, any authenticated employee, in any ACTIVE
// course. Enrolling twice is a conflict rather than a silent no-op —
// same "explicit error over quiet idempotency" choice as ASSET-04's
// double-assign check.
export async function enrollInCourse(organizationId: string, courseId: string, userId: string) {
  const course = await getOrgCourse(organizationId, courseId);
  if (course.status !== CourseStatus.ACTIVE) {
    throw AppError.conflict("COURSE_NOT_ACTIVE", `Cannot enroll in a course in status ${course.status}`);
  }
  const employee = await getEmployeeByUserId(organizationId, userId);

  try {
    return await prisma.courseEnrollment.create({
      data: { courseId, employeeId: employee.id },
      include: ENROLLMENT_INCLUDE,
    });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      throw AppError.conflict("ALREADY_ENROLLED", "You are already enrolled in this course");
    }
    throw err;
  }
}

// LMS-06 — HR-triggered bulk enrollment (e.g. for a mandatory course),
// same "calculate/create for everyone eligible right now" shape as
// PerformanceReviewCycle's open() and payroll's calculate step.
// skipDuplicates makes this safe to call more than once, or after new
// employees have since become ACTIVE.
export async function enrollAllActiveEmployees(organizationId: string, courseId: string, actorId: string) {
  await getOrgCourse(organizationId, courseId);

  return prisma.$transaction(async (tx) => {
    const activeEmployees = await tx.employee.findMany({
      where: { organizationId, status: EmployeeStatus.ACTIVE },
      select: { id: true },
    });

    let created = 0;
    if (activeEmployees.length > 0) {
      const result = await tx.courseEnrollment.createMany({
        data: activeEmployees.map((employee) => ({ courseId, employeeId: employee.id })),
        skipDuplicates: true,
      });
      created = result.count;
    }

    await recordAudit(
      {
        organizationId,
        actorId,
        action: "COURSE_ENROLLED_ALL_ACTIVE",
        resourceType: "Course",
        resourceId: courseId,
        metadata: { newlyEnrolled: created },
      },
      tx,
    );

    return { newlyEnrolled: created };
  });
}

// LMS-04/05 — self-reported only; no manager/HR sign-off step (Wave 2
// scope decision). Idempotent: completing an already-completed enrollment
// just refreshes completedAt rather than erroring — there's no downstream
// state that would make a double-complete meaningfully different from a
// no-op, unlike e.g. asset return (which closes a specific
// AssetAssignment row and would desync if called twice).
export async function completeCourse(organizationId: string, courseId: string, userId: string) {
  await getOrgCourse(organizationId, courseId);
  const employee = await getEmployeeByUserId(organizationId, userId);

  const enrollment = await prisma.courseEnrollment.findUnique({
    where: { courseId_employeeId: { courseId, employeeId: employee.id } },
  });
  if (!enrollment) {
    throw AppError.conflict("NOT_ENROLLED", "You must enroll in this course before marking it complete");
  }

  return prisma.courseEnrollment.update({
    where: { id: enrollment.id },
    data: { completedAt: new Date() },
    include: ENROLLMENT_INCLUDE,
  });
}

// LMS-07 — HR/Super Admin see every enrollment in the org; anyone else
// sees only their own, same force-scope pattern as expenses/assets.
export async function listEnrollments(
  organizationId: string,
  requester: { userId: string; role: AuthContext["role"] },
  query: ListEnrollmentsQuery,
) {
  const where: Prisma.CourseEnrollmentWhereInput = { course: { organizationId } };

  if (requester.role !== "HR_ADMIN" && requester.role !== "SUPER_ADMIN") {
    const employee = await getEmployeeByUserId(organizationId, requester.userId);
    where.employeeId = employee.id;
  } else if (query.employeeId) {
    where.employeeId = query.employeeId;
  }

  if (query.courseId) {
    where.courseId = query.courseId;
  }

  const [items, total] = await Promise.all([
    prisma.courseEnrollment.findMany({
      where,
      include: ENROLLMENT_INCLUDE,
      orderBy: { enrolledAt: "desc" },
      skip: (query.page - 1) * query.pageSize,
      take: query.pageSize,
    }),
    prisma.courseEnrollment.count({ where }),
  ]);

  return { items, meta: { page: query.page, pageSize: query.pageSize, total } };
}
