import { Router } from "express";
import { requireCandidateAuth } from "@common/auth/requireCandidateAuth";
import { asyncHandler } from "@common/middleware/asyncHandler";
import { loginRateLimiter } from "@common/middleware/rateLimiter";
import { resumeUpload } from "@common/upload/multerConfig";
import {
  applyToJobPostingHandler,
  getCandidateApplicationHandler,
  getCandidatePortalMeHandler,
  getPublicJobPostingHandler,
  listCandidateApplicationsHandler,
  listPublicJobPostingsHandler,
  loginCandidateHandler,
  registerCandidateHandler,
} from "@modules/careers/careers.controller";

// Sprint 3 Wave 1 HLD §4.1, Handbook CAREER-*. Fully public — no
// requireAuth, no requireRole. Every handler resolves organizationId from
// the :orgSlug param server-side (careers.service.ts's
// resolvePublicOrganization); the client never supplies an org id.
export const careersRouter = Router();

careersRouter.get("/:orgSlug/jobs", asyncHandler(listPublicJobPostingsHandler));
careersRouter.get("/:orgSlug/jobs/:id", asyncHandler(getPublicJobPostingHandler));
// CAREER-01/03 — the one truly public, unauthenticated write surface in the
// system; rate-limited more aggressively than authenticated routes (same
// limiter as internal /auth/login).
careersRouter.post("/:orgSlug/register", loginRateLimiter, asyncHandler(registerCandidateHandler));
careersRouter.post("/:orgSlug/login", loginRateLimiter, asyncHandler(loginCandidateHandler));

// CAREER-05..08 — requireCandidateAuth only, structurally separate from
// requireAuth/requireRole (see requireCandidateAuth.ts).
export const candidatePortalRouter = Router();

candidatePortalRouter.get("/me", requireCandidateAuth, asyncHandler(getCandidatePortalMeHandler));
candidatePortalRouter.post(
  "/jobs/:jobId/apply",
  requireCandidateAuth,
  resumeUpload.single("resume"),
  asyncHandler(applyToJobPostingHandler),
);
candidatePortalRouter.get(
  "/applications",
  requireCandidateAuth,
  asyncHandler(listCandidateApplicationsHandler),
);
candidatePortalRouter.get(
  "/applications/:id",
  requireCandidateAuth,
  asyncHandler(getCandidateApplicationHandler),
);
