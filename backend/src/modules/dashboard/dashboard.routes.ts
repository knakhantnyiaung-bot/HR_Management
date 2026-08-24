import { Router } from "express";
import { requireAuth } from "@common/auth/requireAuth";
import { notImplemented } from "@common/middleware/notImplemented";

export const dashboardRouter = Router();

dashboardRouter.get("/hr", requireAuth, notImplemented);
dashboardRouter.get("/me", requireAuth, notImplemented);
