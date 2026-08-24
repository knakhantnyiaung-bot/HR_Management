import { Router } from "express";
import { requireAuth, requireRole } from "@common/auth/requireAuth";
import { asyncHandler } from "@common/middleware/asyncHandler";
import { notImplemented } from "@common/middleware/notImplemented";
import {
  activateEmployeeHandler,
  createEmployeeHandler,
  deactivateEmployeeHandler,
  getEmployeeHandler,
  listEmployeesHandler,
  terminateEmployeeHandler,
  updateEmployeeHandler,
} from "@modules/employees/employees.controller";

// HLD Appendix B + roadmap item 5 (CRUD, lifecycle, account linking).
// HR Admin / Super Admin manage the roster; an Employee may only read their
// own record (HLD section 10 RBAC table: Employees column = "Own only").
export const employeesRouter = Router();

const HR_ROLES = ["HR_ADMIN", "SUPER_ADMIN"] as const;

employeesRouter.get("/", requireAuth, requireRole(...HR_ROLES), asyncHandler(listEmployeesHandler));
employeesRouter.post("/", requireAuth, requireRole(...HR_ROLES), asyncHandler(createEmployeeHandler));
employeesRouter.get("/:id", requireAuth, asyncHandler(getEmployeeHandler));
employeesRouter.patch(
  "/:id",
  requireAuth,
  requireRole(...HR_ROLES),
  asyncHandler(updateEmployeeHandler),
);

// Lifecycle transitions (Appendix C: DRAFT -> ACTIVE -> INACTIVE / TERMINATED)
employeesRouter.post(
  "/:id/activate",
  requireAuth,
  requireRole(...HR_ROLES),
  asyncHandler(activateEmployeeHandler),
);
employeesRouter.post(
  "/:id/deactivate",
  requireAuth,
  requireRole(...HR_ROLES),
  asyncHandler(deactivateEmployeeHandler),
);
employeesRouter.post(
  "/:id/terminate",
  requireAuth,
  requireRole(...HR_ROLES),
  asyncHandler(terminateEmployeeHandler),
);

// Salary is a separate roadmap item (#9) — left as scaffolded stubs for now.
employeesRouter.get("/:id/salary-profile", requireAuth, notImplemented);
employeesRouter.patch("/:id/salary-profile", requireAuth, notImplemented);
