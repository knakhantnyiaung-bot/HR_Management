import type { Request, Response } from "express";
import { requireAuthContext, requireIdParam, requireParam } from "@common/http/requestHelpers";
import { storageAdapter } from "@common/storage/storageAdapter";
import {
  assignHiringManagerSchema,
  createCandidateSchema,
  createHiringManagerSchema,
  createInterviewSchema,
  createJobPostingSchema,
  createOfferSchema,
  listApplicationsQuerySchema,
  listJobPostingsQuerySchema,
  respondOfferSchema,
  updateApplicationStageSchema,
  updateInterviewSchema,
  updateJobPostingStatusSchema,
} from "@modules/recruitment/recruitment.schema";
import {
  assignHiringManager,
  convertApplicationToEmployee,
  createCandidateForPosting,
  createHiringManager,
  createInterview,
  createJobPosting,
  createOffer,
  getCandidateResumeForDownload,
  listApplications,
  listHiringManagers,
  listJobPostings,
  rescindOffer,
  respondToOffer,
  updateApplicationStage,
  updateInterview,
  updateJobPostingStatus,
} from "@modules/recruitment/recruitment.service";

export async function listHiringManagersHandler(req: Request, res: Response): Promise<void> {
  const { organizationId } = requireAuthContext(req);
  const managers = await listHiringManagers(organizationId);
  res.json({ success: true, data: managers });
}

export async function createHiringManagerHandler(req: Request, res: Response): Promise<void> {
  const { organizationId, userId } = requireAuthContext(req);
  const input = createHiringManagerSchema.parse(req.body);
  const result = await createHiringManager(organizationId, input, userId);
  res.status(201).json({ success: true, data: result });
}

export async function listJobPostingsHandler(req: Request, res: Response): Promise<void> {
  const { organizationId } = requireAuthContext(req);
  const query = listJobPostingsQuerySchema.parse(req.query);
  const result = await listJobPostings(organizationId, query);
  res.json({ success: true, data: result.items, meta: result.meta });
}

export async function createJobPostingHandler(req: Request, res: Response): Promise<void> {
  const { organizationId, userId } = requireAuthContext(req);
  const input = createJobPostingSchema.parse(req.body);
  const posting = await createJobPosting(organizationId, input, userId);
  res.status(201).json({ success: true, data: posting });
}

export async function updateJobPostingStatusHandler(req: Request, res: Response): Promise<void> {
  const { organizationId, userId } = requireAuthContext(req);
  const input = updateJobPostingStatusSchema.parse(req.body);
  const posting = await updateJobPostingStatus(organizationId, requireIdParam(req), input.status, userId);
  res.json({ success: true, data: posting });
}

export async function createCandidateHandler(req: Request, res: Response): Promise<void> {
  const { organizationId, userId } = requireAuthContext(req);
  const input = createCandidateSchema.parse(req.body);
  const file = req.file as Express.Multer.File | undefined;
  const application = await createCandidateForPosting(
    organizationId,
    requireIdParam(req),
    input,
    userId,
    file ? { buffer: file.buffer, mimetype: file.mimetype, originalname: file.originalname } : undefined,
  );
  res.status(201).json({ success: true, data: application });
}

export async function listApplicationsHandler(req: Request, res: Response): Promise<void> {
  const { organizationId, userId, role } = requireAuthContext(req);
  const query = listApplicationsQuerySchema.parse(req.query);
  const result = await listApplications(organizationId, { userId, role }, query);
  res.json({ success: true, data: result.items, meta: result.meta });
}

export async function updateApplicationStageHandler(req: Request, res: Response): Promise<void> {
  const { organizationId, userId, role } = requireAuthContext(req);
  const input = updateApplicationStageSchema.parse(req.body);
  const application = await updateApplicationStage(organizationId, requireIdParam(req), input.stage, {
    userId,
    role,
  });
  res.json({ success: true, data: application });
}

export async function assignHiringManagerHandler(req: Request, res: Response): Promise<void> {
  const { organizationId, userId } = requireAuthContext(req);
  const input = assignHiringManagerSchema.parse(req.body);
  const application = await assignHiringManager(
    organizationId,
    requireIdParam(req),
    input.hiringManagerUserId,
    userId,
  );
  res.json({ success: true, data: application });
}

export async function createInterviewHandler(req: Request, res: Response): Promise<void> {
  const { organizationId, userId, role } = requireAuthContext(req);
  const input = createInterviewSchema.parse(req.body);
  const interview = await createInterview(organizationId, requireIdParam(req), input, {
    userId,
    role,
  });
  res.status(201).json({ success: true, data: interview });
}

export async function updateInterviewHandler(req: Request, res: Response): Promise<void> {
  const { organizationId, userId, role } = requireAuthContext(req);
  const input = updateInterviewSchema.parse(req.body);
  const interview = await updateInterview(
    organizationId,
    requireIdParam(req),
    requireParam(req, "interviewId"),
    input,
    { userId, role },
  );
  res.json({ success: true, data: interview });
}

export async function createOfferHandler(req: Request, res: Response): Promise<void> {
  const { organizationId, userId } = requireAuthContext(req);
  const input = createOfferSchema.parse(req.body);
  const offer = await createOffer(organizationId, requireIdParam(req), input, userId);
  res.status(201).json({ success: true, data: offer });
}

export async function rescindOfferHandler(req: Request, res: Response): Promise<void> {
  const { organizationId, userId } = requireAuthContext(req);
  const offer = await rescindOffer(
    organizationId,
    requireIdParam(req),
    requireParam(req, "offerId"),
    userId,
  );
  res.json({ success: true, data: offer });
}

export async function respondOfferHandler(req: Request, res: Response): Promise<void> {
  const { organizationId, userId } = requireAuthContext(req);
  const input = respondOfferSchema.parse(req.body);
  const offer = await respondToOffer(
    organizationId,
    requireIdParam(req),
    requireParam(req, "offerId"),
    input.status,
    userId,
  );
  res.json({ success: true, data: offer });
}

export async function convertApplicationHandler(req: Request, res: Response): Promise<void> {
  const { organizationId, userId } = requireAuthContext(req);
  const result = await convertApplicationToEmployee(organizationId, requireIdParam(req), userId);
  res.json({ success: true, data: result });
}

export async function downloadCandidateResumeHandler(req: Request, res: Response): Promise<void> {
  const { organizationId, userId, role } = requireAuthContext(req);
  const candidate = await getCandidateResumeForDownload(organizationId, requireIdParam(req), {
    userId,
    role,
  });

  res.setHeader("Content-Disposition", `attachment; filename="${candidate.resumeFileName}"`);
  storageAdapter.readStream(candidate.resumeStorageKey!).pipe(res);
}
