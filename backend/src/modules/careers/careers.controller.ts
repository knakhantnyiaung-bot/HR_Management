import type { Request, Response } from "express";
import { requireCandidateAuthContext, requireIdParam, requireParam } from "@common/http/requestHelpers";
import {
  listCandidateApplicationsQuerySchema,
  listPublicJobPostingsQuerySchema,
  loginCandidateSchema,
  registerCandidateSchema,
} from "@modules/careers/careers.schema";
import {
  applyToJobPosting,
  authenticateCandidate,
  getCandidateApplication,
  getCandidatePortalMe,
  getPublicJobPosting,
  listCandidateApplications,
  listPublicJobPostings,
  registerCandidatePortalAccount,
  resolvePublicOrganization,
} from "@modules/careers/careers.service";

function requireSlugParam(req: Request): string {
  return requireParam(req, "orgSlug");
}

// ---------------------------------------------------------------------------
// Public — /api/v1/careers/:orgSlug/*
// ---------------------------------------------------------------------------

export async function listPublicJobPostingsHandler(req: Request, res: Response): Promise<void> {
  const organization = await resolvePublicOrganization(requireSlugParam(req));
  const query = listPublicJobPostingsQuerySchema.parse(req.query);
  const result = await listPublicJobPostings(organization.id, query);
  res.json({ success: true, data: result.items, meta: result.meta });
}

export async function getPublicJobPostingHandler(req: Request, res: Response): Promise<void> {
  const organization = await resolvePublicOrganization(requireSlugParam(req));
  const posting = await getPublicJobPosting(organization.id, requireIdParam(req));
  res.json({ success: true, data: posting });
}

export async function registerCandidateHandler(req: Request, res: Response): Promise<void> {
  const organization = await resolvePublicOrganization(requireSlugParam(req));
  const input = registerCandidateSchema.parse(req.body);
  const result = await registerCandidatePortalAccount(organization.id, input);
  res.status(201).json({ success: true, data: result });
}

export async function loginCandidateHandler(req: Request, res: Response): Promise<void> {
  const organization = await resolvePublicOrganization(requireSlugParam(req));
  const input = loginCandidateSchema.parse(req.body);
  const result = await authenticateCandidate(organization.id, input);
  res.json({ success: true, data: result });
}

// ---------------------------------------------------------------------------
// Candidate portal — /api/v1/candidate-portal/* (requireCandidateAuth)
// ---------------------------------------------------------------------------

export async function getCandidatePortalMeHandler(req: Request, res: Response): Promise<void> {
  const { candidateId } = requireCandidateAuthContext(req);
  const candidate = await getCandidatePortalMe(candidateId);
  res.json({ success: true, data: candidate });
}

export async function applyToJobPostingHandler(req: Request, res: Response): Promise<void> {
  const { candidateId, organizationId } = requireCandidateAuthContext(req);
  const jobPostingId = requireParam(req, "jobId");
  const file = req.file as Express.Multer.File | undefined;

  const application = await applyToJobPosting(
    organizationId,
    candidateId,
    jobPostingId,
    file
      ? { buffer: file.buffer, mimetype: file.mimetype, originalname: file.originalname }
      : undefined,
  );
  res.status(201).json({ success: true, data: application });
}

export async function listCandidateApplicationsHandler(req: Request, res: Response): Promise<void> {
  const { candidateId } = requireCandidateAuthContext(req);
  const query = listCandidateApplicationsQuerySchema.parse(req.query);
  const result = await listCandidateApplications(candidateId, query);
  res.json({ success: true, data: result.items, meta: result.meta });
}

export async function getCandidateApplicationHandler(req: Request, res: Response): Promise<void> {
  const { candidateId } = requireCandidateAuthContext(req);
  const application = await getCandidateApplication(candidateId, requireIdParam(req));
  res.json({ success: true, data: application });
}
