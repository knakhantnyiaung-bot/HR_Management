import { Router } from "express";
import { requireAuth } from "@common/auth/requireAuth";
import { asyncHandler } from "@common/middleware/asyncHandler";
import { aiChatRateLimiter } from "@common/middleware/rateLimiter";
import { chatHandler } from "@modules/ai/ai.controller";

// Sprint 3 Wave 3, Handbook AI-01..05. Any authenticated employee — the
// scope restriction to their own data happens inside ai.service.ts, not
// via a role check here.
export const aiRouter = Router();

aiRouter.post("/chat", requireAuth, aiChatRateLimiter, asyncHandler(chatHandler));
