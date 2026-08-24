import { Router } from "express";
import { requireAuth } from "@common/auth/requireAuth";
import { notImplemented } from "@common/middleware/notImplemented";

export const payslipsRouter = Router();

payslipsRouter.get("/", requireAuth, notImplemented);
payslipsRouter.get("/:id", requireAuth, notImplemented);
