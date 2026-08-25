import { Router } from "express";
import { requireAuth, requireRole } from "@common/auth/requireAuth";
import { asyncHandler } from "@common/middleware/asyncHandler";
import { getEmployeeDashboardHandler, getHrDashboardHandler } from "@modules/dashboard/dashboard.controller";

// Handbook section 15 — HR dashboard aggregates org-wide operational metrics
// (HR Admin/Super Admin only); Employee dashboard is self-service, scoped to
// the caller's own Employee record via getEmployeeByUserId.
export const dashboardRouter = Router();

const HR_ROLES = ["HR_ADMIN", "SUPER_ADMIN"] as const;

dashboardRouter.get("/hr", requireAuth, requireRole(...HR_ROLES), asyncHandler(getHrDashboardHandler));
dashboardRouter.get("/me", requireAuth, asyncHandler(getEmployeeDashboardHandler));
