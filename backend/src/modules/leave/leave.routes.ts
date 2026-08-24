import { Router } from "express";
import { requireAuth } from "@common/auth/requireAuth";
import { notImplemented } from "@common/middleware/notImplemented";

// HLD section 12 — Leave state machine: PENDING -> APPROVED/REJECTED/CANCELLED
export const leaveRouter = Router();

leaveRouter.post("/requests", requireAuth, notImplemented);
leaveRouter.get("/requests", requireAuth, notImplemented);
leaveRouter.post("/requests/:id/approve", requireAuth, notImplemented);
leaveRouter.post("/requests/:id/reject", requireAuth, notImplemented);
leaveRouter.post("/requests/:id/cancel", requireAuth, notImplemented);
