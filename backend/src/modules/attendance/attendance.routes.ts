import { Router } from "express";
import { requireAuth, requireRole } from "@common/auth/requireAuth";
import { asyncHandler } from "@common/middleware/asyncHandler";
import {
  checkInHandler,
  checkOutHandler,
  correctAttendanceHandler,
  listAttendanceHandler,
} from "@modules/attendance/attendance.controller";

// HLD section 11 — Attendance Architecture. Check-in/out are self-service
// (HLD section 10 RBAC table: Attendance column = "Own" for Employee);
// listing scopes to the caller's own records unless they're HR/Super Admin.
// Corrections are HR-only with a mandatory audit reason.
export const attendanceRouter = Router();

attendanceRouter.post("/check-in", requireAuth, asyncHandler(checkInHandler));
attendanceRouter.post("/check-out", requireAuth, asyncHandler(checkOutHandler));
attendanceRouter.get("/", requireAuth, asyncHandler(listAttendanceHandler));
attendanceRouter.post(
  "/:id/correct",
  requireAuth,
  requireRole("HR_ADMIN", "SUPER_ADMIN"),
  asyncHandler(correctAttendanceHandler),
);
