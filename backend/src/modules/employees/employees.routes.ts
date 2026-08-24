import { Router } from "express";
import { requireAuth, requireRole } from "@common/auth/requireAuth";
import { asyncHandler } from "@common/middleware/asyncHandler";
import {
  activateEmployeeHandler,
  createEmployeeHandler,
  deactivateEmployeeHandler,
  getEmployeeHandler,
  listEmployeesHandler,
  terminateEmployeeHandler,
  updateEmployeeHandler,
} from "@modules/employees/employees.controller";
import {
  getSalaryProfileHandler,
  listSalaryProfileHistoryHandler,
  updateSalaryProfileHandler,
} from "@modules/salary/salary.controller";

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

// Salary (roadmap item #9) is owned by the salary module (HLD section 7),
// but its URLs nest under /employees/:id per Appendix B.
// RBAC (section 10): HR Admin "Manage", Employee "Own limited view".
employeesRouter.get("/:id/salary-profile", requireAuth, asyncHandler(getSalaryProfileHandler));
employeesRouter.patch(
  "/:id/salary-profile",
  requireAuth,
  requireRole(...HR_ROLES),
  asyncHandler(updateSalaryProfileHandler),
);
employeesRouter.get(
  "/:id/salary-profile/history",
  requireAuth,
  requireRole(...HR_ROLES),
  asyncHandler(listSalaryProfileHistoryHandler),
);
