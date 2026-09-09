import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { CandidateApplicationStage, JobPostingStatus, Prisma } from "@prisma/client";
import { env } from "@config/env";
import { prisma } from "@database/prisma";
import { AppError } from "@common/errors/AppError";
import { extensionForMimeType } from "@common/upload/multerConfig";
import { storageAdapter } from "@common/storage/storageAdapter";
import { recordAudit } from "@modules/audit/audit.service";
import { toCandidateApplicationView } from "@modules/careers/careers.candidateView";
import type {
  ListCandidateApplicationsQuery,
  ListPublicJobPostingsQuery,
  LoginCandidateInput,
  RegisterCandidateInput,
} from "@modules/careers/careers.schema";

// Not a real candidate's hash — same timing-attack mitigation as
// auth.service.ts's DUMMY_PASSWORD_HASH, kept as a separate local copy
// since candidate auth is a deliberately separate system (Sprint 3 HLD §3),
// not because the value itself needs to differ.
const DUMMY_PASSWORD_HASH = "$2b$10$7T7vNwID.peQz/tOpfQ/n.18/T.YkEeIlX4YtKCmuw31S.O/41WoC";

function signCandidateToken(candidateId: string): string {
  return jwt.sign({ candidateId, typ: "candidate" }, env.candidateJwtSecret, {
    expiresIn: env.candidateJwtExpiresIn as jwt.SignOptions["expiresIn"],
  });
}

// ---------------------------------------------------------------------------
// Public surface — CAREER-01/02, no auth. Every function here resolves
// organizationId from the slug itself; callers never pass a client-supplied
// org id.
// ---------------------------------------------------------------------------

// CAREER-01 — an org with no careersSlug, or careersEnabled=false, has no
// public page at all (404), not an empty one.
export async function resolvePublicOrganization(orgSlug: string) {
  const organization = await prisma.organization.findFirst({
    where: { careersSlug: orgSlug, careersEnabled: true },
    select: { id: true, name: true },
  });
  if (!organization) {
    throw AppError.notFound("Careers page");
  }
  return organization;
}

const PUBLIC_JOB_POSTING_SELECT = {
  id: true,
  title: true,
  employmentType: true,
  openings: true,
  createdAt: true,
  department: { select: { name: true } },
  position: { select: { title: true } },
} satisfies Prisma.JobPostingSelect;

export async function listPublicJobPostings(organizationId: string, query: ListPublicJobPostingsQuery) {
  const where: Prisma.JobPostingWhereInput = { organizationId, status: JobPostingStatus.OPEN };

  const [items, total] = await Promise.all([
    prisma.jobPosting.findMany({
      where,
      select: PUBLIC_JOB_POSTING_SELECT,
      orderBy: { createdAt: "desc" },
      skip: (query.page - 1) * query.pageSize,
      take: query.pageSize,
    }),
    prisma.jobPosting.count({ where }),
  ]);

  return { items, meta: { page: query.page, pageSize: query.pageSize, total } };
}

export async function getPublicJobPosting(organizationId: string, jobPostingId: string) {
  const posting = await prisma.jobPosting.findFirst({
    where: { id: jobPostingId, organizationId, status: JobPostingStatus.OPEN },
    select: PUBLIC_JOB_POSTING_SELECT,
  });
  if (!posting) {
    throw AppError.notFound("JobPosting");
  }
  return posting;
}

// ---------------------------------------------------------------------------
// Candidate account — CAREER-03/04
// ---------------------------------------------------------------------------

// CAREER-03 — a Candidate row from Sprint 2's HR-entry flow (REC-01) may
// already exist with this email; registering reuses it rather than creating
// a duplicate Candidate. A Candidate that already has a portal account is a
// conflict — log in instead.
export async function registerCandidatePortalAccount(
  organizationId: string,
  input: RegisterCandidateInput,
) {
  const passwordHash = await bcrypt.hash(input.password, 10);

  const candidate = await prisma.$transaction(async (tx) => {
    const existing = await tx.candidate.findFirst({
      where: { organizationId, email: input.email },
      include: { portalAccount: true },
    });
    if (existing?.portalAccount) {
      throw AppError.conflict(
        "ACCOUNT_ALREADY_EXISTS",
        "An account with this email already exists. Log in instead.",
      );
    }

    const candidateRow = existing
      ? await tx.candidate.update({
          where: { id: existing.id },
          data: { fullName: input.fullName, phone: input.phone ?? existing.phone },
        })
      : await tx.candidate.create({
          data: {
            organizationId,
            fullName: input.fullName,
            email: input.email,
            phone: input.phone,
            source: "CAREERS_PORTAL",
          },
        });

    await tx.candidatePortalAccount.create({
      data: { candidateId: candidateRow.id, passwordHash },
    });

    await recordAudit(
      {
        organizationId,
        action: "CANDIDATE_PORTAL_ACCOUNT_REGISTERED",
        resourceType: "Candidate",
        resourceId: candidateRow.id,
        metadata: { email: input.email, reusedExistingCandidate: existing !== null },
      },
      tx,
    );

    return candidateRow;
  });

  return { token: signCandidateToken(candidate.id), candidate };
}

export async function authenticateCandidate(organizationId: string, input: LoginCandidateInput) {
  const candidate = await prisma.candidate.findFirst({
    where: { organizationId, email: input.email },
    include: { portalAccount: true },
  });

  if (!candidate?.portalAccount || candidate.portalAccount.status !== "ACTIVE") {
    await bcrypt.compare(input.password, DUMMY_PASSWORD_HASH);
    throw AppError.unauthorized("Invalid credentials");
  }

  const valid = await bcrypt.compare(input.password, candidate.portalAccount.passwordHash);
  if (!valid) {
    throw AppError.unauthorized("Invalid credentials");
  }

  await prisma.candidatePortalAccount.update({
    where: { candidateId: candidate.id },
    data: { lastLoginAt: new Date() },
  });

  return { token: signCandidateToken(candidate.id), candidate };
}

export async function getCandidatePortalMe(candidateId: string) {
  return prisma.candidate.findUniqueOrThrow({
    where: { id: candidateId },
    select: { id: true, fullName: true, email: true, phone: true, createdAt: true },
  });
}

// ---------------------------------------------------------------------------
// Applications — CAREER-06..08
// ---------------------------------------------------------------------------

const CANDIDATE_APPLICATION_INCLUDE = {
  jobPosting: { select: { id: true, title: true, employmentType: true } },
  interviews: { orderBy: { scheduledAt: "asc" } },
  offers: { orderBy: { createdAt: "desc" } },
} satisfies Prisma.CandidateApplicationInclude;

// CAREER-06 — reuses REC-02/03's rules (forward-only stage machine,
// duplicate-open-application check) but is its own function rather than a
// call into recruitment.service.ts's createCandidateForPosting: that
// function always creates a fresh Candidate row, which is right for HR
// typing in a new candidate's details but wrong here — a logged-in
// candidate already has exactly one Candidate row (from registration), and
// applying to a second posting must reuse it, not duplicate it. The
// duplicate-application check is scoped by candidateId instead of an email
// string match for the same reason: the candidate is already identified,
// not being looked up.
export async function applyToJobPosting(
  organizationId: string,
  candidateId: string,
  jobPostingId: string,
  resumeFile?: { buffer: Buffer; mimetype: string; originalname: string },
) {
  const posting = await prisma.jobPosting.findFirst({
    where: { id: jobPostingId, organizationId, status: JobPostingStatus.OPEN },
  });
  if (!posting) {
    throw AppError.notFound("JobPosting");
  }

  return prisma.$transaction(async (tx) => {
    const existingOpenApplication = await tx.candidateApplication.findFirst({
      where: {
        jobPostingId,
        candidateId,
        stage: { notIn: [CandidateApplicationStage.REJECTED, CandidateApplicationStage.WITHDRAWN] },
      },
    });
    if (existingOpenApplication) {
      throw AppError.conflict(
        "DUPLICATE_APPLICATION",
        "You already have an open application to this posting",
      );
    }

    if (resumeFile) {
      const resumeStorageKey = await storageAdapter.save(
        resumeFile.buffer,
        extensionForMimeType(resumeFile.mimetype),
      );
      await tx.candidate.update({
        where: { id: candidateId },
        data: { resumeStorageKey, resumeFileName: resumeFile.originalname },
      });
    }

    const application = await tx.candidateApplication.create({
      data: { candidateId, jobPostingId, stage: CandidateApplicationStage.APPLIED },
      include: CANDIDATE_APPLICATION_INCLUDE,
    });

    await recordAudit(
      {
        organizationId,
        action: "CANDIDATE_APPLIED_VIA_PORTAL",
        resourceType: "CandidateApplication",
        resourceId: application.id,
        metadata: { candidateId, jobPostingId },
      },
      tx,
    );

    return toCandidateApplicationView(application);
  });
}

export async function listCandidateApplications(
  candidateId: string,
  query: ListCandidateApplicationsQuery,
) {
  const where: Prisma.CandidateApplicationWhereInput = { candidateId };

  const [items, total] = await Promise.all([
    prisma.candidateApplication.findMany({
      where,
      include: CANDIDATE_APPLICATION_INCLUDE,
      orderBy: { stageUpdatedAt: "desc" },
      skip: (query.page - 1) * query.pageSize,
      take: query.pageSize,
    }),
    prisma.candidateApplication.count({ where }),
  ]);

  return {
    items: items.map(toCandidateApplicationView),
    meta: { page: query.page, pageSize: query.pageSize, total },
  };
}

export async function getCandidateApplication(candidateId: string, applicationId: string) {
  const application = await prisma.candidateApplication.findFirst({
    where: { id: applicationId, candidateId },
    include: CANDIDATE_APPLICATION_INCLUDE,
  });
  if (!application) {
    throw AppError.notFound("CandidateApplication");
  }
  return toCandidateApplicationView(application);
}
