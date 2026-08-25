import "dotenv/config";

function required(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

export const env = {
  nodeEnv: process.env.NODE_ENV ?? "development",
  port: Number(process.env.PORT ?? 4000),
  databaseUrl: required("DATABASE_URL"),
  // No insecure fallback here on purpose — a missing JWT_SECRET must fail
  // startup, not silently sign/verify tokens with a value that's sitting in
  // this repo's own .env.example.
  jwtSecret: required("JWT_SECRET"),
  jwtExpiresIn: process.env.JWT_EXPIRES_IN ?? "8h",
  defaultTimezone: process.env.DEFAULT_TIMEZONE ?? "Asia/Yangon",
  defaultCurrency: process.env.DEFAULT_CURRENCY ?? "MMK",
};
