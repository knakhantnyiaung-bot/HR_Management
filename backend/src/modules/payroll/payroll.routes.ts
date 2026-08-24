import { Router } from "express";
import { requireAuth, requireRole } from "@common/auth/requireAuth";
import { asyncHandler } from "@common/middleware/asyncHandler";
import {
  approvePayrollRunHandler,
  calculatePayrollRunHandler,
  createPayrollRunHandler,
  getPayrollRunHandler,
  listPayrollRunsHandler,
  markPayrollRunPaidHandler,
} from "@modules/payroll/payroll.controller";

// HLD section 13 — Payroll Architecture + roadmap item 10. Payroll is the
// most sensitive domain in the MVP; RBAC (section 10) makes it entirely
// HR Admin/Super Admin — an Employee's only touchpoint is the Payslip
// module (roadmap item 11, not this one).
// State machine (Appendix C): DRAFT -> CALCULATED -> APPROVED -> PAID.
export const payrollRouter = Router();

const HR_ROLES = ["HR_ADMIN", "SUPER_ADMIN"] as const;

payrollRouter.post("/runs", requireAuth, requireRole(...HR_ROLES), asyncHandler(createPayrollRunHandler));
payrollRouter.get("/runs", requireAuth, requireRole(...HR_ROLES), asyncHandler(listPayrollRunsHandler));
payrollRouter.get("/runs/:id", requireAuth, requireRole(...HR_ROLES), asyncHandler(getPayrollRunHandler));
payrollRouter.post(
  "/runs/:id/calculate",
  requireAuth,
  requireRole(...HR_ROLES),
  asyncHandler(calculatePayrollRunHandler),
);
payrollRouter.post(
  "/runs/:id/approve",
  requireAuth,
  requireRole(...HR_ROLES),
  asyncHandler(approvePayrollRunHandler),
);
payrollRouter.post(
  "/runs/:id/mark-paid",
  requireAuth,
  requireRole(...HR_ROLES),
  asyncHandler(markPayrollRunPaidHandler),
);
