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
  return ["http://localhost:5173"];
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
  corsOrigin: corsOrigin(),
  defaultTimezone: process.env.DEFAULT_TIMEZONE ?? "Asia/Yangon",
  defaultCurrency: process.env.DEFAULT_CURRENCY ?? "MMK",
};
