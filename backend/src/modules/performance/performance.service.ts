import { EmployeeStatus, Prisma, ReviewCycleStatus } from "@prisma/client";
import { prisma } from "@database/prisma";
import type { AuthContext } from "@common/auth/requireAuth";
import { AppError } from "@common/errors/AppError";
import { recordAudit } from "@modules/audit/audit.service";
import { getEmployeeByUserId } from "@modules/employees/employees.service";
import type {
  CreateReviewCycleInput,
  ListReviewCyclesQuery,
  ListReviewsQuery,
  SubmitManagerReviewInput,
  SubmitSelfReviewInput,
} from "@modules/performance/performance.schema";

// ---------------------------------------------------------------------------
// Review cycles — PERF-01/02/05
// ---------------------------------------------------------------------------

export async function listReviewCycles(organizationId: string, query: ListReviewCyclesQuery) {
  const where: Prisma.PerformanceReviewCycleWhereInput = { organizationId };

  const [items, total] = await Promise.all([
    prisma.performanceReviewCycle.findMany({
      where,
      orderBy: { periodStart: "desc" },
      skip: (query.page - 1) * query.pageSize,
      take: query.pageSize,
    }),
    prisma.performanceReviewCycle.count({ where }),
  ]);

  return { items, meta: { page: query.page, pageSize: query.pageSize, total } };
}

export async function createReviewCycle(
  organizationId: string,
  input: CreateReviewCycleInput,
  actorId: string,
) {
  return prisma.$transaction(async (tx) => {
    const cycle = await tx.performanceReviewCycle.create({
      data: { organizationId, ...input },
    });

    await recordAudit(
      {
        organizationId,
        actorId,
        action: "REVIEW_CYCLE_CREATED",
        resourceType: "PerformanceReviewCycle",
        resourceId: cycle.id,
        metadata: { name: input.name },
      },
      tx,
    );

    return cycle;
  });
}

async function getOrgCycle(organizationId: string, cycleId: string) {
  const cycle = await prisma.performanceReviewCycle.findFirst({
    where: { id: cycleId, organizationId },
  });
  if (!cycle) {
    throw AppError.notFound("PerformanceReviewCycle");
  }
  return cycle;
}

// PERF-02 — opening a cycle bulk-creates one PerformanceReview per
// currently-ACTIVE employee, same "calculate for everyone eligible right
// now" shape as payroll.service.ts's calculate step. Idempotent against
// re-running: createMany's skipDuplicates relies on the (cycleId,
// employeeId) unique constraint, so opening twice (or an employee becoming
// ACTIVE mid-cycle and a re-open) never duplicates a review row.
export async function openReviewCycle(organizationId: string, cycleId: string, actorId: string) {
  const cycle = await getOrgCycle(organizationId, cycleId);
  if (cycle.status !== ReviewCycleStatus.DRAFT) {
    throw AppError.conflict(
      "INVALID_STATUS_TRANSITION",
      `Cannot open a review cycle in status ${cycle.status}`,
    );
  }

  return prisma.$transaction(async (tx) => {
    const activeEmployees = await tx.employee.findMany({
      where: { organizationId, status: EmployeeStatus.ACTIVE },
      select: { id: true },
    });

    if (activeEmployees.length > 0) {
      await tx.performanceReview.createMany({
        data: activeEmployees.map((employee) => ({ cycleId, employeeId: employee.id })),
        skipDuplicates: true,
      });
    }

    const updated = await tx.performanceReviewCycle.update({
      where: { id: cycleId },
      data: { status: ReviewCycleStatus.OPEN },
    });

    await recordAudit(
      {
        organizationId,
        actorId,
        action: "REVIEW_CYCLE_OPENED",
        resourceType: "PerformanceReviewCycle",
        resourceId: cycleId,
        metadata: { reviewCount: activeEmployees.length },
      },
      tx,
    );

    return updated;
  });
}

export async function closeReviewCycle(organizationId: string, cycleId: string, actorId: string) {
  const cycle = await getOrgCycle(organizationId, cycleId);
  if (cycle.status !== ReviewCycleStatus.OPEN) {
    throw AppError.conflict(
      "INVALID_STATUS_TRANSITION",
      `Cannot close a review cycle in status ${cycle.status}`,
    );
  }

  return prisma.$transaction(async (tx) => {
    const updated = await tx.performanceReviewCycle.update({
      where: { id: cycleId },
      data: { status: ReviewCycleStatus.CLOSED },
    });

    await recordAudit(
      {
        organizationId,
        actorId,
        action: "REVIEW_CYCLE_CLOSED",
        resourceType: "PerformanceReviewCycle",
        resourceId: cycleId,
      },
      tx,
    );

    return updated;
  });
}

// ---------------------------------------------------------------------------
// Reviews — PERF-03/04/06
// ---------------------------------------------------------------------------

const REVIEW_INCLUDE = {
  cycle: { select: { id: true, name: true, status: true, periodStart: true, periodEnd: true } },
  employee: {
    select: {
      id: true,
      employeeNo: true,
      managerId: true,
      user: { select: { email: true } },
    },
  },
} satisfies Prisma.PerformanceReviewInclude;

type ReviewWithRelations = Prisma.PerformanceReviewGetPayload<{ include: typeof REVIEW_INCLUDE }>;

// Deliberately not a stored column (see schema.prisma) — computed here so
// there's exactly one place this can drift out of sync with the two
// timestamps it's derived from.
function deriveReviewStatus(review: { selfSubmittedAt: Date | null; managerSubmittedAt: Date | null }) {
  if (review.managerSubmittedAt) return "COMPLETED" as const;
  if (review.selfSubmittedAt) return "SELF_SUBMITTED" as const;
  return "PENDING" as const;
}

function toReviewView(review: ReviewWithRelations) {
  return { ...review, status: deriveReviewStatus(review) };
}

// PERF-06 — HR/Super Admin see every review in the org; anyone else sees
// only reviews that are their own (employeeId) or a direct report's
// (employee.managerId), same "resolve own Employee row, then scope the
// where clause" shape as expenses/assets.
async function resourceScopeWhere(
  organizationId: string,
  requester: { userId: string; role: AuthContext["role"] },
): Promise<Prisma.PerformanceReviewWhereInput> {
  if (requester.role === "HR_ADMIN" || requester.role === "SUPER_ADMIN") {
    return {};
  }
  const employee = await getEmployeeByUserId(organizationId, requester.userId);
  return { OR: [{ employeeId: employee.id }, { employee: { managerId: employee.id } }] };
}

export async function listReviews(
  organizationId: string,
  requester: { userId: string; role: AuthContext["role"] },
  query: ListReviewsQuery,
) {
  const scope = await resourceScopeWhere(organizationId, requester);
  const where: Prisma.PerformanceReviewWhereInput = {
    cycle: { organizationId },
    ...scope,
    ...(query.cycleId ? { cycleId: query.cycleId } : {}),
    ...(query.employeeId ? { employeeId: query.employeeId } : {}),
  };

  const [items, total] = await Promise.all([
    prisma.performanceReview.findMany({
      where,
      include: REVIEW_INCLUDE,
      orderBy: { updatedAt: "desc" },
      skip: (query.page - 1) * query.pageSize,
      take: query.pageSize,
    }),
    prisma.performanceReview.count({ where }),
  ]);

  return { items: items.map(toReviewView), meta: { page: query.page, pageSize: query.pageSize, total } };
}

async function getScopedReview(
  organizationId: string,
  reviewId: string,
  requester: { userId: string; role: AuthContext["role"] },
): Promise<ReviewWithRelations> {
  const scope = await resourceScopeWhere(organizationId, requester);
  const review = await prisma.performanceReview.findFirst({
    where: { id: reviewId, cycle: { organizationId }, ...scope },
    include: REVIEW_INCLUDE,
  });
  if (!review) {
    throw AppError.notFound("PerformanceReview");
  }
  return review;
}

export async function getReview(
  organizationId: string,
  reviewId: string,
  requester: { userId: string; role: AuthContext["role"] },
) {
  return toReviewView(await getScopedReview(organizationId, reviewId, requester));
}

// PERF-04 — the employee may update their own self section any time the
// cycle is OPEN; no lock once the manager has submitted (Wave 2 scope:
// simplicity over gaming-prevention).
export async function submitSelfReview(
  organizationId: string,
  reviewId: string,
  input: SubmitSelfReviewInput,
  requester: { userId: string; role: AuthContext["role"] },
) {
  const existing = await getScopedReview(organizationId, reviewId, requester);
  const employee = await getEmployeeByUserId(organizationId, requester.userId);
  if (existing.employeeId !== employee.id) {
    throw AppError.forbidden("You may only submit your own self-review");
  }
  if (existing.cycle.status !== ReviewCycleStatus.OPEN) {
    throw AppError.conflict(
      "CYCLE_NOT_OPEN",
      `Cannot submit a self-review while the cycle is ${existing.cycle.status}`,
    );
  }

  await prisma.performanceReview.update({
    where: { id: reviewId },
    data: {
      goals: input.goals,
      selfRating: input.selfRating,
      selfComments: input.selfComments,
      selfSubmittedAt: new Date(),
    },
  });

  return getReview(organizationId, reviewId, requester);
}

// PERF-04/06 — the assigned manager (Employee.managerId) or HR/Super Admin
// (standing in when there's no manager set) may submit the manager
// section.
export async function submitManagerReview(
  organizationId: string,
  reviewId: string,
  input: SubmitManagerReviewInput,
  requester: { userId: string; role: AuthContext["role"] },
) {
  const existing = await getScopedReview(organizationId, reviewId, requester);

  const isHr = requester.role === "HR_ADMIN" || requester.role === "SUPER_ADMIN";
  if (!isHr) {
    const employee = await getEmployeeByUserId(organizationId, requester.userId);
    if (existing.employee.managerId !== employee.id) {
      throw AppError.forbidden("You may only submit a manager review for your direct reports");
    }
  }
  if (existing.cycle.status !== ReviewCycleStatus.OPEN) {
    throw AppError.conflict(
      "CYCLE_NOT_OPEN",
      `Cannot submit a manager review while the cycle is ${existing.cycle.status}`,
    );
  }

  await prisma.performanceReview.update({
    where: { id: reviewId },
    data: {
      managerRating: input.managerRating,
      managerComments: input.managerComments,
      managerSubmittedAt: new Date(),
      managerUserId: requester.userId,
    },
  });

  return getReview(organizationId, reviewId, requester);
}
