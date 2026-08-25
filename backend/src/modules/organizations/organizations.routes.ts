import { Router } from "express";
import { requireAuth, requireRole } from "@common/auth/requireAuth";
import { asyncHandler } from "@common/middleware/asyncHandler";
import {
  getOrganizationHandler,
  updateOrganizationHandler,
} from "@modules/organizations/organizations.controller";

// HLD section 3.1 permission matrix: "Organization settings" = Super Admin
// R/W, HR Admin R, Employee no access. Departments/positions are their own
// modules/routers (departments.routes.ts, positions.routes.ts), not nested
// under this one.
export const organizationsRouter = Router();

organizationsRouter.get(
  "/",
  requireAuth,
  requireRole("HR_ADMIN", "SUPER_ADMIN"),
  asyncHandler(getOrganizationHandler),
);
organizationsRouter.patch(
  "/",
  requireAuth,
  requireRole("SUPER_ADMIN"),
  asyncHandler(updateOrganizationHandler),
);
