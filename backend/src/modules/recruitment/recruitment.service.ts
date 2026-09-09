import bcrypt from "bcrypt";
import { CandidateApplicationStage, InterviewStatus, OfferStatus, Prisma } from "@prisma/client";
import { prisma } from "@database/prisma";
import type { AuthContext } from "@common/auth/requireAuth";
import { AppError } from "@common/errors/AppError";
import { extensionForMimeType } from "@common/upload/multerConfig";
import { storageAdapter } from "@common/storage/storageAdapter";
import { recordAudit } from "@modules/audit/audit.service";
import {
  assertDepartmentAndPosition,
  createEmployeeInTransaction,
  generateTempPassword,
} from "@modules/employees/employees.service";
import { emitNotificationEvent } from "@modules/notifications/notification.emitter";
import { getHrAdminUserIds } from "@modules/notifications/notification.recipients";
import type {
  CreateCandidateInput,
  CreateHiringManagerInput,
  CreateInterviewInput,
  CreateJobPostingInput,
  CreateOfferInput,
  ListApplicationsQuery,
  ListJobPostingsQuery,
  UpdateInterviewInput,
} from "@modules/recruitment/recruitment.schema";

const APPLICATION_INCLUDE = {
  candidate: true,
  jobPosting: {
    select: {
      id: true,
      title: true,
      departmentId: true,
      positionId: true,
      organizationId: true,
    },
  },
  hiringManager: { select: { id: true, email: true } },
  interviews: { orderBy: { scheduledAt: "asc" } },
  offers: { orderBy: { createdAt: "desc" } },
} satisfies Prisma.CandidateApplicationInclude;

// ---------------------------------------------------------------------------
// Job postings — REC-08
// ---------------------------------------------------------------------------

export async function listJobPostings(organizationId: string, query: ListJobPostingsQuery) {
  const where: Prisma.JobPostingWhereInput = { organizationId, ...(query.status ? { status: query.status } : {}) };

  const [items, total] = await Promise.all([
    prisma.jobPosting.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (query.page - 1) * query.pageSize,
      take: query.pageSize,
    }),
    prisma.jobPosting.count({ where }),
  ]);

  return { items, meta: { page: query.page, pageSize: query.pageSize, total } };
}

export async function createJobPosting(
  organizationId: string,
  input: CreateJobPostingInput,
  actorId: string,
) {
  await assertDepartmentAndPosition(organizationId, input.departmentId, input.positionId);

  return prisma.$transaction(async (tx) => {
    const posting = await tx.jobPosting.create({
      data: {
        organizationId,
        title: input.title,
        departmentId: input.departmentId,
        positionId: input.positionId,
        employmentType: input.employmentType,
        openings: input.openings,
      },
    });

    await recordAudit(
      {
        organizationId,
        actorId,
        action: "JOB_POSTING_CREATED",
        resourceType: "JobPosting",
        resourceId: posting.id,
        metadata: { title: input.title },
      },
      tx,
    );

    return posting;
  });
}

export async function updateJobPostingStatus(
  organizationId: string,
  postingId: string,
  status: "DRAFT" | "OPEN" | "CLOSED" | "ARCHIVED",
  actorId: string,
) {
  const existing = await prisma.jobPosting.findFirst({ where: { id: postingId, organizationId } });
  if (!existing) {
    throw AppError.notFound("JobPosting");
  }

  // REC-08 — no hard delete; ARCHIVED is the terminal state once a posting
  // has candidates. Not enforced as a DB constraint (a posting can be
  // archived at any time by design), just never destroyed.
  return prisma.$transaction(async (tx) => {
    const updated = await tx.jobPosting.update({ where: { id: postingId }, data: { status } });

    await recordAudit(
      {
        organizationId,
        actorId,
        action: "JOB_POSTING_STATUS_UPDATED",
        resourceType: "JobPosting",
        resourceId: postingId,
        metadata: { from: existing.status, to: status },
      },
      tx,
    );

    return updated;
  });
}

// ---------------------------------------------------------------------------
// Candidates & applications — REC-01..REC-03
// ---------------------------------------------------------------------------

export async function createCandidateForPosting(
  organizationId: string,
  jobPostingId: string,
  input: CreateCandidateInput,
  actorId: string,
  resumeFile?: { buffer: Buffer; mimetype: string; originalname: string },
) {
  const posting = await prisma.jobPosting.findFirst({ where: { id: jobPostingId, organizationId } });
  if (!posting) {
    throw AppError.notFound("JobPosting");
  }

  return prisma.$transaction(async (tx) => {
    // REC-03 — no two open (non-terminal) applications for the same
    // candidate email against the same posting. Enforced here (locked
    // transaction) rather than a DB partial-unique index — see the Sprint 2
    // plan's note on why.
    const existingOpenApplication = await tx.candidateApplication.findFirst({
      where: {
        jobPostingId,
        stage: { notIn: [CandidateApplicationStage.REJECTED, CandidateApplicationStage.WITHDRAWN] },
        candidate: { email: input.email },
      },
    });
    if (existingOpenApplication) {
      throw AppError.conflict(
        "DUPLICATE_APPLICATION",
        "This candidate already has an open application to this posting",
      );
    }

    let resumeStorageKey: string | undefined;
    if (resumeFile) {
      resumeStorageKey = await storageAdapter.save(
        resumeFile.buffer,
        extensionForMimeType(resumeFile.mimetype),
      );
    }

    const candidate = await tx.candidate.create({
      data: {
        organizationId,
        fullName: input.fullName,
        email: input.email,
        phone: input.phone,
        source: input.source,
        ...(resumeStorageKey
          ? { resumeStorageKey, resumeFileName: resumeFile!.originalname }
          : {}),
      },
    });

    const application = await tx.candidateApplication.create({
      data: {
        candidateId: candidate.id,
        jobPostingId,
        stage: CandidateApplicationStage.APPLIED,
      },
      include: APPLICATION_INCLUDE,
    });

    await recordAudit(
      {
        organizationId,
        actorId,
        action: "CANDIDATE_CREATED",
        resourceType: "Candidate",
        resourceId: candidate.id,
        metadata: { email: input.email, jobPostingId },
      },
      tx,
    );

    return application;
  });
}

export async function listApplications(
  organizationId: string,
  requester: { userId: string; role: AuthContext["role"] },
  query: ListApplicationsQuery,
) {
  const where: Prisma.CandidateApplicationWhereInput = {
    jobPosting: { organizationId },
    ...(query.jobPostingId ? { jobPostingId: query.jobPostingId } : {}),
    ...(query.stage ? { stage: query.stage } : {}),
    ...(query.id ? { id: query.id } : {}),
  };

  // REC-06 — Hiring Manager sees only applications assigned to them,
  // regardless of the assignedToMe filter value.
  if (requester.role === "HIRING_MANAGER" || query.assignedToMe) {
    where.hiringManagerUserId = requester.userId;
  }

  const [items, total] = await Promise.all([
    prisma.candidateApplication.findMany({
      where,
      include: APPLICATION_INCLUDE,
      orderBy: { stageUpdatedAt: "desc" },
      skip: (query.page - 1) * query.pageSize,
      take: query.pageSize,
    }),
    prisma.candidateApplication.count({ where }),
  ]);

  return { items, meta: { page: query.page, pageSize: query.pageSize, total } };
}

interface LockedApplicationRow {
  id: string;
  stage: CandidateApplicationStage;
  hiringManagerUserId: string | null;
  jobPostingId: string;
  candidateId: string;
}

// Same FOR UPDATE pattern as leave/overtime/payroll/expenses — locks via a
// join since CandidateApplication has no organizationId of its own (it
// belongs to the org only through JobPosting).
async function lockApplication(
  tx: Prisma.TransactionClient,
  organizationId: string,
  applicationId: string,
): Promise<LockedApplicationRow> {
  const rows = await tx.$queryRaw<LockedApplicationRow[]>`
    SELECT ca.id, ca.stage, ca.hiring_manager_user_id AS "hiringManagerUserId",
           ca.job_posting_id AS "jobPostingId", ca.candidate_id AS "candidateId"
    FROM candidate_applications ca
    INNER JOIN job_postings jp ON jp.id = ca.job_posting_id
    WHERE ca.id = ${applicationId} AND jp.organization_id = ${organizationId}
    FOR UPDATE
  `;
  const row = rows[0];
  if (!row) {
    throw AppError.notFound("CandidateApplication");
  }
  return row;
}

async function reloadApplication(tx: Prisma.TransactionClient, applicationId: string) {
  return tx.candidateApplication.findUniqueOrThrow({
    where: { id: applicationId },
    include: APPLICATION_INCLUDE,
  });
}

// REC-02 — forward-only, REJECTED/WITHDRAWN terminal from any stage. HIRED
// is excluded (schema-enforced by updateApplicationStageSchema) — only
// reachable via convertApplicationToEmployee.
const ALLOWED_STAGE_TRANSITIONS: Record<CandidateApplicationStage, CandidateApplicationStage[]> = {
  APPLIED: [
    CandidateApplicationStage.SCREENING,
    CandidateApplicationStage.REJECTED,
    CandidateApplicationStage.WITHDRAWN,
  ],
  SCREENING: [
    CandidateApplicationStage.INTERVIEW,
    CandidateApplicationStage.REJECTED,
    CandidateApplicationStage.WITHDRAWN,
  ],
  INTERVIEW: [
    CandidateApplicationStage.OFFER,
    CandidateApplicationStage.REJECTED,
    CandidateApplicationStage.WITHDRAWN,
  ],
  OFFER: [CandidateApplicationStage.REJECTED, CandidateApplicationStage.WITHDRAWN],
  HIRED: [],
  REJECTED: [],
  WITHDRAWN: [],
};

// Stages a Hiring Manager may set (REC-06: "advance/reject a stage up to
// but not including OFFER").
const HIRING_MANAGER_ALLOWED_TARGETS: CandidateApplicationStage[] = [
  CandidateApplicationStage.SCREENING,
  CandidateApplicationStage.INTERVIEW,
  CandidateApplicationStage.REJECTED,
  CandidateApplicationStage.WITHDRAWN,
];

export async function updateApplicationStage(
  organizationId: string,
  applicationId: string,
  target: CandidateApplicationStage,
  actor: { userId: string; role: AuthContext["role"] },
) {
  return prisma.$transaction(async (tx) => {
    const locked = await lockApplication(tx, organizationId, applicationId);

    if (actor.role === "HIRING_MANAGER") {
      if (locked.hiringManagerUserId !== actor.userId) {
        throw AppError.forbidden("You may only act on candidates assigned to you");
      }
      if (!HIRING_MANAGER_ALLOWED_TARGETS.includes(target)) {
        throw AppError.forbidden("Hiring Managers cannot advance an application to this stage");
      }
    }

    if (!ALLOWED_STAGE_TRANSITIONS[locked.stage].includes(target)) {
      throw AppError.conflict(
        "INVALID_STATUS_TRANSITION",
        `Cannot transition application from ${locked.stage} to ${target}`,
      );
    }

    await tx.candidateApplication.update({
      where: { id: applicationId },
      data: { stage: target, stageUpdatedAt: new Date() },
    });

    await recordAudit(
      {
        organizationId,
        actorId: actor.userId,
        action: "APPLICATION_STAGE_UPDATED",
        resourceType: "CandidateApplication",
        resourceId: applicationId,
        metadata: { from: locked.stage, to: target },
      },
      tx,
    );

    return reloadApplication(tx, applicationId);
  });
}

// ---------------------------------------------------------------------------
// Hiring Manager accounts — §3.1: not an Employee, HR-provisioned directly.
// ---------------------------------------------------------------------------

export async function listHiringManagers(organizationId: string) {
  return prisma.user.findMany({
    where: { organizationId, role: "HIRING_MANAGER" },
    select: { id: true, email: true, status: true },
    orderBy: { email: "asc" },
  });
}

export async function createHiringManager(
  organizationId: string,
  input: CreateHiringManagerInput,
  actorId: string,
): Promise<{ user: { id: string; email: string }; temporaryPassword?: string }> {
  const temporaryPassword = input.password ? undefined : generateTempPassword();
  const passwordHash = await bcrypt.hash(input.password ?? temporaryPassword!, 10);

  try {
    const user = await prisma.$transaction(async (tx) => {
      const created = await tx.user.create({
        data: { organizationId, email: input.email, passwordHash, role: "HIRING_MANAGER" },
        select: { id: true, email: true },
      });

      await recordAudit(
        {
          organizationId,
          actorId,
          action: "HIRING_MANAGER_CREATED",
          resourceType: "User",
          resourceId: created.id,
          metadata: { email: input.email },
        },
        tx,
      );

      return created;
    });

    return { user, temporaryPassword };
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      throw AppError.conflict(
        "EMAIL_ALREADY_EXISTS",
        "A user with this email already exists in the organization",
      );
    }
    throw err;
  }
}

export async function assignHiringManager(
  organizationId: string,
  applicationId: string,
  hiringManagerUserId: string | null,
  actorId: string,
) {
  if (hiringManagerUserId) {
    const manager = await prisma.user.findFirst({
      where: { id: hiringManagerUserId, organizationId, role: "HIRING_MANAGER" },
    });
    if (!manager) {
      throw AppError.badRequest(
        "INVALID_HIRING_MANAGER",
        "hiringManagerUserId must reference a Hiring Manager in this organization",
      );
    }
  }

  return prisma.$transaction(async (tx) => {
    await lockApplication(tx, organizationId, applicationId);

    await tx.candidateApplication.update({
      where: { id: applicationId },
      data: { hiringManagerUserId },
    });

    await recordAudit(
      {
        organizationId,
        actorId,
        action: "APPLICATION_HIRING_MANAGER_ASSIGNED",
        resourceType: "CandidateApplication",
        resourceId: applicationId,
        metadata: { hiringManagerUserId },
      },
      tx,
    );

    return reloadApplication(tx, applicationId);
  });
}

// ---------------------------------------------------------------------------
// Interviews
// ---------------------------------------------------------------------------

function assertInterviewScope(
  application: LockedApplicationRow,
  actor: { userId: string; role: AuthContext["role"] },
) {
  if (actor.role === "HIRING_MANAGER" && application.hiringManagerUserId !== actor.userId) {
    throw AppError.forbidden("You may only act on candidates assigned to you");
  }
}

export async function createInterview(
  organizationId: string,
  applicationId: string,
  input: CreateInterviewInput,
  actor: { userId: string; role: AuthContext["role"] },
) {
  return prisma.$transaction(async (tx) => {
    const locked = await lockApplication(tx, organizationId, applicationId);
    assertInterviewScope(locked, actor);

    const interview = await tx.interview.create({
      data: { applicationId, ...input },
    });

    await recordAudit(
      {
        organizationId,
        actorId: actor.userId,
        action: "INTERVIEW_SCHEDULED",
        resourceType: "Interview",
        resourceId: interview.id,
        metadata: { applicationId, scheduledAt: input.scheduledAt },
      },
      tx,
    );

    if (locked.hiringManagerUserId) {
      const candidate = await tx.candidate.findUniqueOrThrow({ where: { id: locked.candidateId } });
      await emitNotificationEvent(tx, {
        organizationId,
        eventType: "recruitment.interview.scheduled",
        recipientUserIds: [locked.hiringManagerUserId],
        data: {
          candidateName: candidate.fullName,
          scheduledAt: input.scheduledAt.toISOString(),
        },
        relatedResourceType: "Interview",
        relatedResourceId: interview.id,
      });
    }

    return interview;
  });
}

export async function updateInterview(
  organizationId: string,
  applicationId: string,
  interviewId: string,
  input: UpdateInterviewInput,
  actor: { userId: string; role: AuthContext["role"] },
) {
  return prisma.$transaction(async (tx) => {
    const locked = await lockApplication(tx, organizationId, applicationId);
    assertInterviewScope(locked, actor);

    const existing = await tx.interview.findFirst({ where: { id: interviewId, applicationId } });
    if (!existing) {
      throw AppError.notFound("Interview");
    }

    const updated = await tx.interview.update({
      where: { id: interviewId },
      data: {
        ...input,
        status: input.status ?? (input.feedback ? InterviewStatus.COMPLETED : existing.status),
      },
    });

    await recordAudit(
      {
        organizationId,
        actorId: actor.userId,
        action: "INTERVIEW_UPDATED",
        resourceType: "Interview",
        resourceId: interviewId,
        metadata: { applicationId },
      },
      tx,
    );

    return updated;
  });
}

// ---------------------------------------------------------------------------
// Offers — REC-04/REC-05
// ---------------------------------------------------------------------------

// HR Admin/Super Admin only (route-level requireRole). Creating an offer
// also advances the application to OFFER stage if it isn't already there —
// avoids an inconsistent state where an offer exists on an application
// still shown at an earlier stage.
export async function createOffer(
  organizationId: string,
  applicationId: string,
  input: CreateOfferInput,
  actorId: string,
) {
  return prisma.$transaction(async (tx) => {
    const locked = await lockApplication(tx, organizationId, applicationId);

    if (locked.stage === CandidateApplicationStage.HIRED || locked.stage === CandidateApplicationStage.REJECTED || locked.stage === CandidateApplicationStage.WITHDRAWN) {
      throw AppError.conflict(
        "INVALID_STATUS_TRANSITION",
        `Cannot create an offer for an application in stage ${locked.stage}`,
      );
    }

    // REC-05 — at most one non-terminal (DRAFT/SENT) offer per application.
    const existingActiveOffer = await tx.offer.findFirst({
      where: { applicationId, status: { in: [OfferStatus.DRAFT, OfferStatus.SENT] } },
    });
    if (existingActiveOffer) {
      throw AppError.conflict(
        "OFFER_ALREADY_ACTIVE",
        "This application already has an active offer",
      );
    }

    const offer = await tx.offer.create({
      data: {
        applicationId,
        proposedSalary: input.proposedSalary,
        currency: input.currency,
        startDate: input.startDate,
        status: OfferStatus.SENT,
        sentAt: new Date(),
      },
    });

    if (locked.stage !== CandidateApplicationStage.OFFER) {
      await tx.candidateApplication.update({
        where: { id: applicationId },
        data: { stage: CandidateApplicationStage.OFFER, stageUpdatedAt: new Date() },
      });
    }

    await recordAudit(
      {
        organizationId,
        actorId,
        action: "OFFER_CREATED",
        resourceType: "Offer",
        resourceId: offer.id,
        metadata: { applicationId, proposedSalary: input.proposedSalary, currency: input.currency },
      },
      tx,
    );

    return offer;
  });
}

export async function rescindOffer(
  organizationId: string,
  applicationId: string,
  offerId: string,
  actorId: string,
) {
  return prisma.$transaction(async (tx) => {
    await lockApplication(tx, organizationId, applicationId);

    const offer = await tx.offer.findFirst({ where: { id: offerId, applicationId } });
    if (!offer) {
      throw AppError.notFound("Offer");
    }
    if (offer.status !== OfferStatus.DRAFT && offer.status !== OfferStatus.SENT) {
      throw AppError.conflict(
        "OFFER_ALREADY_RESPONDED",
        `Cannot rescind an offer in status ${offer.status}`,
      );
    }

    const updated = await tx.offer.update({
      where: { id: offerId },
      data: { status: OfferStatus.RESCINDED },
    });

    await recordAudit(
      {
        organizationId,
        actorId,
        action: "OFFER_RESCINDED",
        resourceType: "Offer",
        resourceId: offerId,
        metadata: { applicationId },
      },
      tx,
    );

    return updated;
  });
}

// HR records the candidate's response manually (REC-01 — no candidate
// portal in Sprint 2).
export async function respondToOffer(
  organizationId: string,
  applicationId: string,
  offerId: string,
  status: "ACCEPTED" | "DECLINED",
  actorId: string,
) {
  return prisma.$transaction(async (tx) => {
    await lockApplication(tx, organizationId, applicationId);

    const offer = await tx.offer.findFirst({ where: { id: offerId, applicationId } });
    if (!offer) {
      throw AppError.notFound("Offer");
    }
    if (offer.status !== OfferStatus.SENT) {
      throw AppError.conflict(
        "OFFER_ALREADY_RESPONDED",
        `Cannot record a response for an offer in status ${offer.status}`,
      );
    }

    const updated = await tx.offer.update({
      where: { id: offerId },
      data: { status, respondedAt: new Date() },
    });

    await recordAudit(
      {
        organizationId,
        actorId,
        action: "OFFER_RESPONSE_RECORDED",
        resourceType: "Offer",
        resourceId: offerId,
        metadata: { applicationId, status },
      },
      tx,
    );

    const candidate = await tx.candidate.findFirst({
      where: { applications: { some: { id: applicationId } } },
    });

    // Sec 12.2 — simplified from the HLD's "notify the HR Admin who created
    // it" (Offer has no createdBy column) to "notify all HR Admins";
    // functionally equivalent at this org size and avoids another migration.
    await emitNotificationEvent(tx, {
      organizationId,
      eventType: "recruitment.offer.responded",
      recipientUserIds: await getHrAdminUserIds(tx, organizationId),
      data: { candidateName: candidate?.fullName ?? "Candidate", status },
      relatedResourceType: "Offer",
      relatedResourceId: offerId,
    });

    return updated;
  });
}

// ---------------------------------------------------------------------------
// Candidate -> Employee handoff — HANDOFF-01..06
// ---------------------------------------------------------------------------

export async function convertApplicationToEmployee(
  organizationId: string,
  applicationId: string,
  actorId: string,
) {
  return prisma.$transaction(async (tx) => {
    const application = await tx.candidateApplication.findFirst({
      where: { id: applicationId, jobPosting: { organizationId } },
      include: {
        candidate: true,
        jobPosting: true,
        offers: { orderBy: { createdAt: "desc" }, take: 1 },
      },
    });
    if (!application) {
      throw AppError.notFound("CandidateApplication");
    }
    if (application.stage === CandidateApplicationStage.HIRED || application.candidate.convertedEmployeeId) {
      throw AppError.conflict("CONVERSION_NOT_ELIGIBLE", "This application has already been converted");
    }

    const latestOffer = application.offers[0];
    if (!latestOffer || latestOffer.status !== OfferStatus.ACCEPTED) {
      throw AppError.conflict(
        "CONVERSION_NOT_ELIGIBLE",
        "An accepted offer is required before converting this candidate",
      );
    }

    const emailInUse = await tx.user.findFirst({
      where: { organizationId, email: application.candidate.email },
    });
    if (emailInUse) {
      throw AppError.conflict(
        "EMAIL_ALREADY_EXISTS",
        "A user with this email already exists in the organization",
      );
    }

    // Same temp-password issuance as manual HR onboarding (employees.service
    // ts's createEmployee) — must be returned to the caller here too, or HR
    // would have no way to hand the new hire their initial credentials.
    const temporaryPassword = generateTempPassword();
    const passwordHash = await bcrypt.hash(temporaryPassword, 10);

    // HANDOFF-02/03 — same Employee-creation service HR onboarding uses,
    // inside this transaction, so the whole conversion is all-or-nothing.
    const employee = await createEmployeeInTransaction(
      tx,
      organizationId,
      {
        email: application.candidate.email,
        passwordHash,
        joinDate: latestOffer.startDate,
        departmentId: application.jobPosting.departmentId,
        positionId: application.jobPosting.positionId,
        workModel: "OFFICE",
      },
      actorId,
    );

    await tx.candidateApplication.update({
      where: { id: applicationId },
      data: { stage: CandidateApplicationStage.HIRED, stageUpdatedAt: new Date() },
    });

    await tx.candidate.update({
      where: { id: application.candidateId },
      data: { convertedEmployeeId: employee.id },
    });

    await recordAudit(
      {
        organizationId,
        actorId,
        action: "CANDIDATE_CONVERTED_TO_EMPLOYEE",
        resourceType: "CandidateApplication",
        resourceId: applicationId,
        metadata: { candidateId: application.candidateId, employeeId: employee.id },
      },
      tx,
    );

    return {
      employee,
      temporaryPassword,
      application: await reloadApplication(tx, applicationId),
    };
  });
}

// ---------------------------------------------------------------------------
// Resume download — Sec 13.3-equivalent access control
// ---------------------------------------------------------------------------

export async function getCandidateResumeForDownload(
  organizationId: string,
  candidateId: string,
  requester: { userId: string; role: AuthContext["role"] },
) {
  const candidate = await prisma.candidate.findFirst({
    where: { id: candidateId, organizationId },
    include: { applications: { select: { hiringManagerUserId: true } } },
  });
  if (!candidate || !candidate.resumeStorageKey) {
    throw AppError.notFound("Candidate resume");
  }

  const isHr = requester.role === "HR_ADMIN" || requester.role === "SUPER_ADMIN";
  const isAssignedHiringManager = candidate.applications.some(
    (app) => app.hiringManagerUserId === requester.userId,
  );
  if (!isHr && !isAssignedHiringManager) {
    throw AppError.forbidden();
  }

  return candidate;
}
