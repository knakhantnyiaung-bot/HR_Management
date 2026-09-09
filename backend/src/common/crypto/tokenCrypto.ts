import { randomBytes, createCipheriv, createDecipheriv } from "node:crypto";
import { env } from "@config/env";
import { AppError } from "@common/errors/AppError";

// CAL-01..07 — the first at-rest secret encryption in this codebase
// (passwords use bcrypt hashing, which is one-way and doesn't apply here:
// the raw OAuth token must be recoverable to call the Google API on the
// org's behalf). AES-256-GCM, key from CALENDAR_TOKEN_ENC_KEY (32 raw
// bytes, hex-encoded in env). Output packs iv (12B) + authTag (16B) +
// ciphertext into one base64 string — nothing else needs to know the
// layout, it's opaque outside this file.
const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12;

function getKey(): Buffer {
  if (!env.calendarTokenEncKey) {
    throw AppError.badRequest(
      "CALENDAR_INTEGRATION_NOT_CONFIGURED",
      "CALENDAR_TOKEN_ENC_KEY is not configured for this deployment",
    );
  }
  const key = Buffer.from(env.calendarTokenEncKey, "hex");
  if (key.length !== 32) {
    throw new Error("CALENDAR_TOKEN_ENC_KEY must be 32 bytes (64 hex characters)");
  }
  return key;
}

export function encryptToken(plaintext: string): string {
  const key = getKey();
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, key, iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return Buffer.concat([iv, authTag, ciphertext]).toString("base64");
}

export function decryptToken(payload: string): string {
  const key = getKey();
  const buffer = Buffer.from(payload, "base64");
  const iv = buffer.subarray(0, IV_LENGTH);
  const authTag = buffer.subarray(IV_LENGTH, IV_LENGTH + 16);
  const ciphertext = buffer.subarray(IV_LENGTH + 16);

  const decipher = createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);
  return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString("utf8");
}
