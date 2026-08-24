import { Router } from "express";
import { requireAuth } from "@common/auth/requireAuth";
import { notImplemented } from "@common/middleware/notImplemented";

export const positionsRouter = Router();

positionsRouter.get("/", requireAuth, notImplemented);
positionsRouter.post("/", requireAuth, notImplemented);
positionsRouter.patch("/:id", requireAuth, notImplemented);
