import { Router } from "express";
import { requireAuth } from "@common/auth/requireAuth";
import { notImplemented } from "@common/middleware/notImplemented";

// HLD section 12 — Overtime state machine: PENDING -> APPROVED -> PAYROLL INPUT
export const overtimeRouter = Router();

overtimeRouter.post("/requests", requireAuth, notImplemented);
overtimeRouter.get("/requests", requireAuth, notImplemented);
overtimeRouter.post("/requests/:id/approve", requireAuth, notImplemented);
overtimeRouter.post("/requests/:id/reject", requireAuth, notImplemented);
