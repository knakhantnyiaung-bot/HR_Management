import { Router } from "express";
import { requireAuth } from "@common/auth/requireAuth";
import { notImplemented } from "@common/middleware/notImplemented";

// HLD Appendix B
export const employeesRouter = Router();

employeesRouter.get("/", requireAuth, notImplemented);
employeesRouter.post("/", requireAuth, notImplemented);
employeesRouter.get("/:id", requireAuth, notImplemented);
employeesRouter.patch("/:id", requireAuth, notImplemented);
employeesRouter.get("/:id/salary-profile", requireAuth, notImplemented);
employeesRouter.patch("/:id/salary-profile", requireAuth, notImplemented);
