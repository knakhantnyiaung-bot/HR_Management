import { Router } from "express";
import { requireAuth } from "@common/auth/requireAuth";
import { asyncHandler } from "@common/middleware/asyncHandler";
import { loginRateLimiter } from "@common/middleware/rateLimiter";
import { login, me } from "@modules/auth/auth.controller";

export const authRouter = Router();

authRouter.post("/login", loginRateLimiter, asyncHandler(login));
authRouter.get("/me", requireAuth, asyncHandler(me));
