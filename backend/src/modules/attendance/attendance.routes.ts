import { Router } from "express";
import { requireAuth } from "@common/auth/requireAuth";
import { notImplemented } from "@common/middleware/notImplemented";

// HLD section 11 — Attendance Architecture
export const attendanceRouter = Router();

attendanceRouter.post("/check-in", requireAuth, notImplemented);
attendanceRouter.post("/check-out", requireAuth, notImplemented);
attendanceRouter.get("/", requireAuth, notImplemented);
