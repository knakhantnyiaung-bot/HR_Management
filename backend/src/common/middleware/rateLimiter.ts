import rateLimit, { ipKeyGenerator } from "express-rate-limit";
import { env } from "@config/env";

// HLD AUTH-06: "Login/reset endpoints are rate-limited." Skipped entirely in
// the test env so the suite's many beforeAll logins (14+ files, each
// authenticating at least once) don't trip it — a real attacker sending
// hundreds of guesses in minutes looks nothing like that.
export const loginRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  skip: () => env.nodeEnv === "test",
  message: {
    success: false,
    error: { code: "TOO_MANY_REQUESTS", message: "Too many login attempts, please try again later" },
  },
});

// AI-05 — each call to /ai/chat hits a paid, per-token Claude API, unlike
// every other endpoint in this app. Keyed per authenticated user (not per
// IP) so one employee's usage can't exhaust another's budget behind a
// shared office IP/NAT.
export const aiChatRateLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  skip: () => env.nodeEnv === "test",
  keyGenerator: (req) => req.auth?.userId ?? ipKeyGenerator(req.ip ?? "unknown"),
  message: {
    success: false,
    error: { code: "TOO_MANY_REQUESTS", message: "Too many AI assistant requests, please slow down" },
  },
});
