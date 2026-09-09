import { Router } from "express";
import { requireAuth, requireRole } from "@common/auth/requireAuth";
import { asyncHandler } from "@common/middleware/asyncHandler";
import {
  closeReviewCycleHandler,
  createReviewCycleHandler,
  getReviewHandler,
  listReviewCyclesHandler,
  listReviewsHandler,
  openReviewCycleHandler,
  submitManagerReviewHandler,
  submitSelfReviewHandler,
} from "@modules/performance/performance.controller";

// Sprint 3 Wave 2, Handbook PERF-*. Cycle management is HR Admin/Super
// Admin only; reviews are resource-scoped in performance.service.ts (own
// review, or a direct report's), so list/get/self/manager stay
// requireAuth-only rather than role-gated at the route level — an
// EMPLOYEE submitting their own self-review and an EMPLOYEE who happens to
// be someone's manager submitting that section are both legitimate here.
export const performanceRouter = Router();

const HR_ROLES = ["HR_ADMIN", "SUPER_ADMIN"] as const;

performanceRouter.get("/cycles", requireAuth, requireRole(...HR_ROLES), asyncHandler(listReviewCyclesHandler));
performanceRouter.post(
  "/cycles",
  requireAuth,
  requireRole(...HR_ROLES),
  asyncHandler(createReviewCycleHandler),
);
performanceRouter.post(
  "/cycles/:id/open",
  requireAuth,
  requireRole(...HR_ROLES),
  asyncHandler(openReviewCycleHandler),
);
performanceRouter.post(
  "/cycles/:id/close",
  requireAuth,
  requireRole(...HR_ROLES),
  asyncHandler(closeReviewCycleHandler),
);

performanceRouter.get("/reviews", requireAuth, asyncHandler(listReviewsHandler));
performanceRouter.get("/reviews/:id", requireAuth, asyncHandler(getReviewHandler));
performanceRouter.patch("/reviews/:id/self", requireAuth, asyncHandler(submitSelfReviewHandler));
performanceRouter.patch("/reviews/:id/manager", requireAuth, asyncHandler(submitManagerReviewHandler));
