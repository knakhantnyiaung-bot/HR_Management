import { Router } from "express";
import { requireAuth } from "@common/auth/requireAuth";
import { asyncHandler } from "@common/middleware/asyncHandler";
import { login, me } from "@modules/auth/auth.controller";

export const authRouter = Router();

authRouter.post("/login", asyncHandler(login));
authRouter.get("/me", requireAuth, asyncHandler(me));
