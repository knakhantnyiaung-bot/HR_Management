import { Router } from "express";
import { requireAuth } from "@common/auth/requireAuth";
import { notImplemented } from "@common/middleware/notImplemented";

// HLD section 13 — Payroll state machine: DRAFT -> CALCULATED -> APPROVED -> PAID
export const payrollRouter = Router();

payrollRouter.post("/runs", requireAuth, notImplemented);
payrollRouter.get("/runs", requireAuth, notImplemented);
payrollRouter.post("/runs/:id/calculate", requireAuth, notImplemented);
payrollRouter.post("/runs/:id/approve", requireAuth, notImplemented);
payrollRouter.post("/runs/:id/mark-paid", requireAuth, notImplemented);
