import { Router } from "express";
import { requireAuth, requireRole } from "@common/auth/requireAuth";
import { asyncHandler } from "@common/middleware/asyncHandler";
import {
  approveLeaveRequestHandler,
  cancelLeaveRequestHandler,
  createLeaveRequestHandler,
  createLeaveTypeHandler,
  grantLeaveBalanceHandler,
  listLeaveBalancesHandler,
  listLeaveRequestsHandler,
  listLeaveTypesHandler,
  rejectLeaveRequestHandler,
} from "@modules/leave/leave.controller";

// HLD section 12 — Leave Workflow Architecture + roadmap item 7 (types,
// balances, requests, approval). RBAC (section 10): HR Admin/Super Admin
// "Manage"/"Approve", Employee "Own requests".
export const leaveRouter = Router();

const HR_ROLES = ["HR_ADMIN", "SUPER_ADMIN"] as const;

leaveRouter.get("/types", requireAuth, asyncHandler(listLeaveTypesHandler));
leaveRouter.post("/types", requireAuth, requireRole(...HR_ROLES), asyncHandler(createLeaveTypeHandler));

leaveRouter.get("/balances", requireAuth, asyncHandler(listLeaveBalancesHandler));
leaveRouter.post(
  "/balances",
  requireAuth,
  requireRole(...HR_ROLES),
  asyncHandler(grantLeaveBalanceHandler),
);

leaveRouter.post("/requests", requireAuth, asyncHandler(createLeaveRequestHandler));
leaveRouter.get("/requests", requireAuth, asyncHandler(listLeaveRequestsHandler));
leaveRouter.post(
  "/requests/:id/approve",
  requireAuth,
  requireRole(...HR_ROLES),
  asyncHandler(approveLeaveRequestHandler),
);
leaveRouter.post(
  "/requests/:id/reject",
  requireAuth,
  requireRole(...HR_ROLES),
  asyncHandler(rejectLeaveRequestHandler),
);
leaveRouter.post("/requests/:id/cancel", requireAuth, asyncHandler(cancelLeaveRequestHandler));
