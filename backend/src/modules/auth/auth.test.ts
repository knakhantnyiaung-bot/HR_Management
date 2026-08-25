import { randomUUID } from "node:crypto";
import bcrypt from "bcrypt";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@database/prisma";
import { createApp } from "../../app";

const app = createApp();

describe("auth module", () => {
  let organizationId: string;
  let departmentId: string;
  let positionId: string;
  let hrToken: string;

  function authed(method: "get" | "post", path: string, token: string) {
    return request(app)[method](path).set("Authorization", `Bearer ${token}`);
  }

  beforeAll(async () => {
    const org = await prisma.organization.create({ data: { name: `Test Org ${randomUUID()}` } });
    organizationId = org.id;

    const department = await prisma.department.create({
      data: { organizationId, name: "Engineering" },
    });
    departmentId = department.id;
    const position = await prisma.position.create({
      data: { organizationId, departmentId, title: "Software Engineer" },
    });
    positionId = position.id;

    const passwordHash = await bcrypt.hash("HrPassword123!", 10);
    await prisma.user.create({
      data: { organizationId, email: "hr@test.local", passwordHash, role: "HR_ADMIN" },
    });
    const hrLogin = await request(app)
      .post("/api/v1/auth/login")
      .send({ email: "hr@test.local", password: "HrPassword123!" });
    hrToken = hrLogin.body.data.token;
  });

  afterAll(async () => {
    await prisma.auditLog.deleteMany({ where: { organizationId } });
    await prisma.employee.deleteMany({ where: { organizationId } });
    await prisma.user.deleteMany({ where: { organizationId } });
    await prisma.position.deleteMany({ where: { organizationId } });
    await prisma.department.deleteMany({ where: { organizationId } });
    await prisma.organization.delete({ where: { id: organizationId } });
    await prisma.$disconnect();
  });

  it("rejects login with a wrong password or an unknown email using the same generic message", async () => {
    const wrongPassword = await request(app)
      .post("/api/v1/auth/login")
      .send({ email: "hr@test.local", password: "WrongPassword!" });
    expect(wrongPassword.status).toBe(401);
    expect(wrongPassword.body.error.message).toBe("Invalid credentials");

    const unknownEmail = await request(app)
      .post("/api/v1/auth/login")
      .send({ email: `nobody.${randomUUID()}@test.local`, password: "WrongPassword!" });
    expect(unknownEmail.status).toBe(401);
    expect(unknownEmail.body.error.message).toBe("Invalid credentials");
  });

  it("rejects requests with no token, a malformed token, or a garbage bearer value", async () => {
    const noToken = await request(app).get("/api/v1/auth/me");
    expect(noToken.status).toBe(401);

    const garbage = await authed("get", "/api/v1/auth/me", "not-a-real-token");
    expect(garbage.status).toBe(401);
  });

  it("returns the current user for a valid token", async () => {
    const res = await authed("get", "/api/v1/auth/me", hrToken);
    expect(res.status).toBe(200);
    expect(res.body.data.email).toBe("hr@test.local");
    expect(res.body.data.role).toBe("HR_ADMIN");
  });

  // Regression test for a fix to requireAuth: a JWT's signature being valid
  // used to be treated as sufficient on its own, so deactivating a user had
  // no effect on a token they'd already been issued — it kept working until
  // it naturally expired. requireAuth now re-reads the user's live status on
  // every request, so this must take effect on the very next call.
  it("revokes an already-issued token the moment the underlying user is deactivated", async () => {
    const email = `worker.revoke.${randomUUID()}@test.local`;
    const password = "EmpPassword123!";
    const create = await authed("post", "/api/v1/employees", hrToken).send({
      email,
      password,
      joinDate: "2026-01-01",
      departmentId,
      positionId,
      workModel: "OFFICE",
    });
    const employeeId = create.body.data.id;
    await authed("post", `/api/v1/employees/${employeeId}/activate`, hrToken);

    const login = await request(app).post("/api/v1/auth/login").send({ email, password });
    const employeeToken = login.body.data.token as string;

    const before = await authed("get", "/api/v1/auth/me", employeeToken);
    expect(before.status).toBe(200);

    await authed("post", `/api/v1/employees/${employeeId}/deactivate`, hrToken);

    const after = await authed("get", "/api/v1/auth/me", employeeToken);
    expect(after.status).toBe(401);
  });
});
