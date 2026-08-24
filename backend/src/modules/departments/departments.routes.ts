import { Router } from "express";
import { requireAuth } from "@common/auth/requireAuth";
import { notImplemented } from "@common/middleware/notImplemented";

export const departmentsRouter = Router();

departmentsRouter.get("/", requireAuth, notImplemented);
departmentsRouter.post("/", requireAuth, notImplemented);
departmentsRouter.patch("/:id", requireAuth, notImplemented);
