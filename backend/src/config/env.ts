import "dotenv/config";

function required(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

const nodeEnv = process.env.NODE_ENV ?? "development";

// CORS_ORIGIN is a comma-separated allowlist. In production there's no safe
// default — an unset value would mean "reflect any origin", defeating the
// point — so it's required there the same way JWT_SECRET is. Dev/test get a
// convenience default matching the Vite dev server so local setup stays
// zero-config.
function corsOrigin(): string[] {
  const configured = process.env.CORS_ORIGIN;
  if (configured) {
    return configured.split(",").map((origin) => origin.trim());
  }
  if (nodeEnv === "production") {
    throw new Error("Missing required environment variable: CORS_ORIGIN");
  }
  return ["http://localhost:5174"];
}

export const env = {
  nodeEnv,
  port: Number(process.env.PORT ?? 4000),
  databaseUrl: required("DATABASE_URL"),
  // No insecure fallback here on purpose — a missing JWT_SECRET must fail
  // startup, not silently sign/verify tokens with a value that's sitting in
  // this repo's own .env.example.
  jwtSecret: required("JWT_SECRET"),
  jwtExpiresIn: process.env.JWT_EXPIRES_IN ?? "8h",
  // CAREER-03/04 — distinct from JWT_SECRET on purpose (HLD §3): a
  // candidate token must be structurally incapable of passing requireAuth,
  // not just logically separate via a claim check. Same fail-fast rule as
  // JWT_SECRET — no insecure fallback.
  candidateJwtSecret: required("CANDIDATE_JWT_SECRET"),
  candidateJwtExpiresIn: process.env.CANDIDATE_JWT_EXPIRES_IN ?? "8h",
  corsOrigin: corsOrigin(),
  defaultTimezone: process.env.DEFAULT_TIMEZONE ?? "Asia/Yangon",
  defaultCurrency: process.env.DEFAULT_CURRENCY ?? "MMK",
  // NOTIF-08..13 — optional: the browser Push API's subscribe() call needs
  // a valid applicationServerKey even though delivery is a console stub in
  // Wave 1 (see PushProvider). No fallback — if unset, the frontend's
  // push-subscription endpoint 404s and push notifications are simply
  // unavailable for this deployment, same "opt-in feature, not required to
  // run the app" treatment as calendar/bank integrations in later waves.
  vapidPublicKey: process.env.VAPID_PUBLIC_KEY,
  // CAL-01..07 — optional, same "opt-in feature" treatment as
  // vapidPublicKey: an org's HR Admin only needs these to exist at the
  // moment they click "Connect Google Calendar" (calendar.service.ts's
  // connect-url/callback handlers), not for the app to start. No Google
  // Cloud project exists for this repo yet — see .env.example for how to
  // create one and fill these in.
  googleClientId: process.env.GOOGLE_CLIENT_ID,
  googleClientSecret: process.env.GOOGLE_CLIENT_SECRET,
  googleRedirectUri: process.env.GOOGLE_REDIRECT_URI,
  // AES-256-GCM key (32 bytes, hex) for calendar OAuth tokens at rest
  // (common/crypto/tokenCrypto.ts). Unlike the Google credentials above,
  // this has no external vendor dependency, so it's generated the same way
  // JWT_SECRET is (openssl rand -hex 32) and can be set even before a
  // Google Cloud project exists.
  calendarTokenEncKey: process.env.CALENDAR_TOKEN_ENC_KEY,
  // AI-01..05 (Sprint 3 Wave 3) — optional, same "opt-in feature" treatment.
  // Without a key, POST /ai/chat returns a clear config-missing error
  // rather than the app failing to start.
  anthropicApiKey: process.env.ANTHROPIC_API_KEY,
  anthropicModel: process.env.ANTHROPIC_MODEL ?? "claude-sonnet-5",
};
