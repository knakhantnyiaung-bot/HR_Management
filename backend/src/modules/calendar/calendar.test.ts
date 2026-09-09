import { randomUUID } from "node:crypto";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@database/prisma";
import { env } from "@config/env";
import { decryptToken, encryptToken } from "@common/crypto/tokenCrypto";
import { createApp } from "../../app";

const app = createApp();

describe("calendar token encryption", () => {
  it("round-trips a plaintext token through encrypt/decrypt", () => {
    const plaintext = "ya29.a0AfH6SMB_example_access_token";
    const encrypted = encryptToken(plaintext);
    expect(encrypted).not.toBe(plaintext);
    expect(decryptToken(encrypted)).toBe(plaintext);
  });

  it("produces a different ciphertext each time (random IV) for the same plaintext", () => {
    const plaintext = "same-plaintext";
    expect(encryptToken(plaintext)).not.toBe(encryptToken(plaintext));
  });
});

// No Google Cloud project exists for this repo (Sprint 3 HLD §11 open
// question) — GOOGLE_CLIENT_ID/SECRET are deliberately unset in .env.test,
// same "optional, degrades gracefully" treatment as VAPID keys. These tests
// cover everything reachable without them: config-missing errors, RBAC,
// and OAuth `state` validation (which fails before ever calling Google).
describe("calendar module (CAL-01..07)", () => {
  let organizationId: string;
  let hrToken: string;
  let employeeToken: string;

  function authed(method: "get" | "delete", path: string, token: string) {
    return request(app)[method](path).set("Authorization", `Bearer ${token}`);
  }

  beforeAll(async () => {
    const org = await prisma.organization.create({ data: { name: `Test Org ${randomUUID()}` } });
    organizationId = org.id;

    const hrHash = await bcrypt.hash("HrPassword123!", 10);
    await prisma.user.create({
      data: { organizationId, email: "hr@test.local", passwordHash: hrHash, role: "HR_ADMIN" },
    });
    const hrLogin = await request(app)
      .post("/api/v1/auth/login")
      .send({ email: "hr@test.local", password: "HrPassword123!" });
    hrToken = hrLogin.body.data.token;

    const empHash = await bcrypt.hash("EmpPassword123!", 10);
    await prisma.user.create({
      data: { organizationId, email: "worker@test.local", passwordHash: empHash, role: "EMPLOYEE" },
    });
    const empLogin = await request(app)
      .post("/api/v1/auth/login")
      .send({ email: "worker@test.local", password: "EmpPassword123!" });
    employeeToken = empLogin.body.data.token;
  });

  afterAll(async () => {
    await prisma.auditLog.deleteMany({ where: { organizationId } });
    await prisma.calendarIntegration.deleteMany({ where: { organizationId } });
    await prisma.user.deleteMany({ where: { organizationId } });
    await prisma.organization.delete({ where: { id: organizationId } });
    await prisma.$disconnect();
  });

  it("reports not connected when no integration exists", async () => {
    const res = await authed("get", "/api/v1/organization/calendar-integration", hrToken);
    expect(res.status).toBe(200);
    expect(res.body.data).toEqual({ connected: false });
  });

  it("rejects an Employee from every calendar-integration route (HR-only)", async () => {
    const status = await authed("get", "/api/v1/organization/calendar-integration", employeeToken);
    expect(status.status).toBe(403);

    const connectUrl = await authed(
      "get",
      "/api/v1/organization/calendar-integration/connect-url",
      employeeToken,
    );
    expect(connectUrl.status).toBe(403);

    const disconnect = await authed("delete", "/api/v1/organization/calendar-integration", employeeToken);
    expect(disconnect.status).toBe(403);
  });

  it("returns a config-missing error for connect-url with no Google credentials configured", async () => {
    const res = await authed(
      "get",
      "/api/v1/organization/calendar-integration/connect-url",
      hrToken,
    );
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("CALENDAR_INTEGRATION_NOT_CONFIGURED");
  });

  it("404s disconnecting when nothing is connected", async () => {
    const res = await authed("delete", "/api/v1/organization/calendar-integration", hrToken);
    expect(res.status).toBe(404);
  });

  it("redirects to the frontend with an error indicator on every callback failure mode", async () => {
    // Google denied consent (or the user clicked cancel).
    const denied = await request(app).get(
      "/api/v1/organization/calendar-integration/callback?error=access_denied",
    );
    expect(denied.status).toBe(302);
    expect(denied.headers.location).toBe(`${env.corsOrigin[0]}/settings?calendar=error`);

    // Missing code/state entirely.
    const missing = await request(app).get("/api/v1/organization/calendar-integration/callback");
    expect(missing.status).toBe(302);
    expect(missing.headers.location).toBe(`${env.corsOrigin[0]}/settings?calendar=error`);

    // A tampered/expired state fails signature verification.
    const badState = await request(app).get(
      "/api/v1/organization/calendar-integration/callback?code=abc&state=not-a-real-jwt",
    );
    expect(badState.status).toBe(302);
    expect(badState.headers.location).toBe(`${env.corsOrigin[0]}/settings?calendar=error`);

    // A validly-signed state still fails here because GOOGLE_CLIENT_ID/
    // SECRET aren't configured in this environment (asserted before ever
    // calling Google) — same redirect either way, matching HLD §8's rule
    // that a Google-side failure never surfaces as a raw error page.
    const validState = jwt.sign({ organizationId, userId: "irrelevant" }, env.jwtSecret, {
      expiresIn: "10m",
    });
    const notConfigured = await request(app).get(
      `/api/v1/organization/calendar-integration/callback?code=abc&state=${validState}`,
    );
    expect(notConfigured.status).toBe(302);
    expect(notConfigured.headers.location).toBe(`${env.corsOrigin[0]}/settings?calendar=error`);
  });
});
