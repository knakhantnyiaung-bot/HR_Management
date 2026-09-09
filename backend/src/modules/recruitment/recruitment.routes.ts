import { Router } from "express";
import { requireAuth, requireRole } from "@common/auth/requireAuth";
import { asyncHandler } from "@common/middleware/asyncHandler";
import { resumeUpload } from "@common/upload/multerConfig";
import {
  assignHiringManagerHandler,
  convertApplicationHandler,
  createCandidateHandler,
  createHiringManagerHandler,
  createInterviewHandler,
  createJobPostingHandler,
  createOfferHandler,
  downloadCandidateResumeHandler,
  listApplicationsHandler,
  listHiringManagersHandler,
  listJobPostingsHandler,
  rescindOfferHandler,
  respondOfferHandler,
  updateApplicationStageHandler,
  updateInterviewHandler,
  updateJobPostingStatusHandler,
} from "@modules/recruitment/recruitment.controller";

// Sprint 2 HLD §14/§15, Handbook REC-*/HANDOFF-*. HR Admin/Super Admin have
// full access; Hiring Manager is resource-scoped (enforced in
// recruitment.service.ts, not just by the role checks below) to postings/
// candidates/interviews it's assigned to, and never touches offers or
// conversion.
export const recruitmentRouter = Router();

const HR_ROLES = ["HR_ADMIN", "SUPER_ADMIN"] as const;
const RECRUITMENT_ROLES = ["HR_ADMIN", "SUPER_ADMIN", "HIRING_MANAGER"] as const;

recruitmentRouter.get(
  "/hiring-managers",
  requireAuth,
  requireRole(...HR_ROLES),
  asyncHandler(listHiringManagersHandler),
);
recruitmentRouter.post(
  "/hiring-managers",
  requireAuth,
  requireRole(...HR_ROLES),
  asyncHandler(createHiringManagerHandler),
);

recruitmentRouter.get(
  "/postings",
  requireAuth,
  requireRole(...RECRUITMENT_ROLES),
  asyncHandler(listJobPostingsHandler),
);
recruitmentRouter.post(
  "/postings",
  requireAuth,
  requireRole(...HR_ROLES),
  asyncHandler(createJobPostingHandler),
);
recruitmentRouter.patch(
  "/postings/:id/status",
  requireAuth,
  requireRole(...HR_ROLES),
  asyncHandler(updateJobPostingStatusHandler),
);
recruitmentRouter.post(
  "/postings/:id/candidates",
  requireAuth,
  requireRole(...HR_ROLES),
  resumeUpload.single("resume"),
  asyncHandler(createCandidateHandler),
);

recruitmentRouter.get(
  "/applications",
  requireAuth,
  requireRole(...RECRUITMENT_ROLES),
  asyncHandler(listApplicationsHandler),
);
recruitmentRouter.patch(
  "/applications/:id/stage",
  requireAuth,
  requireRole(...RECRUITMENT_ROLES),
  asyncHandler(updateApplicationStageHandler),
);
recruitmentRouter.patch(
  "/applications/:id/assign",
  requireAuth,
  requireRole(...HR_ROLES),
  asyncHandler(assignHiringManagerHandler),
);

recruitmentRouter.post(
  "/applications/:id/interviews",
  requireAuth,
  requireRole(...RECRUITMENT_ROLES),
  asyncHandler(createInterviewHandler),
);
recruitmentRouter.patch(
  "/applications/:id/interviews/:interviewId",
  requireAuth,
  requireRole(...RECRUITMENT_ROLES),
  asyncHandler(updateInterviewHandler),
);

recruitmentRouter.post(
  "/applications/:id/offer",
  requireAuth,
  requireRole(...HR_ROLES),
  asyncHandler(createOfferHandler),
);
recruitmentRouter.post(
  "/applications/:id/offer/:offerId/rescind",
  requireAuth,
  requireRole(...HR_ROLES),
  asyncHandler(rescindOfferHandler),
);
recruitmentRouter.post(
  "/applications/:id/offer/:offerId/respond",
  requireAuth,
  requireRole(...HR_ROLES),
  asyncHandler(respondOfferHandler),
);

recruitmentRouter.post(
  "/applications/:id/convert",
  requireAuth,
  requireRole(...HR_ROLES),
  asyncHandler(convertApplicationHandler),
);

recruitmentRouter.get(
  "/candidates/:id/resume",
  requireAuth,
  requireRole(...RECRUITMENT_ROLES),
  asyncHandler(downloadCandidateResumeHandler),
);
