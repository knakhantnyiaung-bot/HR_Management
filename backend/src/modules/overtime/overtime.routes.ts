import { Router } from "express";
import { requireAuth, requireRole } from "@common/auth/requireAuth";
import { asyncHandler } from "@common/middleware/asyncHandler";
import {
  approveOvertimeRequestHandler,
  cancelOvertimeRequestHandler,
  createOvertimeRequestHandler,
  listOvertimeRequestsHandler,
  rejectOvertimeRequestHandler,
} from "@modules/overtime/overtime.controller";

// HLD section 12 — Overtime Workflow Architecture + roadmap item 8. RBAC
// (section 10): HR Admin/Super Admin "Approve", Employee "Own requests".
export const overtimeRouter = Router();

const HR_ROLES = ["HR_ADMIN", "SUPER_ADMIN"] as const;

overtimeRouter.post("/requests", requireAuth, asyncHandler(createOvertimeRequestHandler));
overtimeRouter.get("/requests", requireAuth, asyncHandler(listOvertimeRequestsHandler));
overtimeRouter.post(
  "/requests/:id/approve",
  requireAuth,
  requireRole(...HR_ROLES),
  asyncHandler(approveOvertimeRequestHandler),
);
overtimeRouter.post(
  "/requests/:id/reject",
  requireAuth,
  requireRole(...HR_ROLES),
  asyncHandler(rejectOvertimeRequestHandler),
);
overtimeRouter.post("/requests/:id/cancel", requireAuth, asyncHandler(cancelOvertimeRequestHandler));
