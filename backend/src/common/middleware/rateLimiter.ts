import rateLimit from "express-rate-limit";
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
