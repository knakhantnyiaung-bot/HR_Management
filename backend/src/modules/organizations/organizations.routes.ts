import { Router } from "express";
import { requireAuth } from "@common/auth/requireAuth";
import { notImplemented } from "@common/middleware/notImplemented";

// HLD Appendix B: organization settings, departments, positions live under this domain.
export const organizationsRouter = Router();

organizationsRouter.get("/", requireAuth, notImplemented);
organizationsRouter.patch("/", requireAuth, notImplemented);
