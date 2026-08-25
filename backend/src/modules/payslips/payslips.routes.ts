import { Router } from "express";
import { requireAuth } from "@common/auth/requireAuth";
import { asyncHandler } from "@common/middleware/asyncHandler";
import { getPayslipHandler, listPayslipsHandler } from "@modules/payslips/payslips.controller";

// HLD section 14 — Payslip API surface is read-only (roadmap item 11:
// "Employee release/view"); release itself happens as a side effect of
// payroll.approvePayrollRun, not a route here. RBAC: HR Admin/Super Admin
// see every payslip in the org; Employee sees only their own (scoped in
// payslips.service, not via requireRole, since both roles hit the same path).
export const payslipsRouter = Router();

payslipsRouter.get("/", requireAuth, asyncHandler(listPayslipsHandler));
payslipsRouter.get("/:id", requireAuth, asyncHandler(getPayslipHandler));
