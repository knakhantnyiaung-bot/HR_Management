import { randomUUID } from "node:crypto";
import bcrypt from "bcrypt";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@database/prisma";
import { createApp } from "../../app";

const app = createApp();

describe("employees module", () => {
  let organizationId: string;
  let departmentId: string;
  let positionId: string;
  let hrToken: string;

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

    const loginRes = await request(app)
      .post("/api/v1/auth/login")
      .send({ email: "hr@test.local", password: "HrPassword123!" });
    hrToken = loginRes.body.data.token;
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

  function authed(method: "get" | "post" | "patch", path: string, token = hrToken) {
    return request(app)[method](path).set("Authorization", `Bearer ${token}`);
  }

  it("creates an employee in DRAFT status with a linked user account", async () => {
    const res = await authed("post", "/api/v1/employees").send({
      email: `new.hire.${randomUUID()}@test.local`,
      joinDate: "2026-01-01",
      departmentId,
      positionId,
      workModel: "OFFICE",
    });

    expect(res.status).toBe(201);
    expect(res.body.data.status).toBe("DRAFT");
    expect(res.body.data.employeeNo).toMatch(/^EMP-\d{4}$/);
    expect(res.body.data.temporaryPassword).toBeTruthy();
    expect(res.body.data.user.status).toBe("ACTIVE");
    // Never leak the password hash.
    expect(res.body.data.user.passwordHash).toBeUndefined();
  });

  it("rejects a duplicate email within the same organization with 409", async () => {
    const email = `dup.${randomUUID()}@test.local`;
    const payload = { email, joinDate: "2026-01-01", departmentId, positionId, workModel: "OFFICE" };

    const first = await authed("post", "/api/v1/employees").send(payload);
    expect(first.status).toBe(201);

    const second = await authed("post", "/api/v1/employees").send(payload);
    expect(second.status).toBe(409);
    expect(second.body.error.code).toBe("EMAIL_ALREADY_EXISTS");
  });

  it("rejects an employee for a department outside the organization with 400", async () => {
    const res = await authed("post", "/api/v1/employees").send({
      email: `bad.dept.${randomUUID()}@test.local`,
      joinDate: "2026-01-01",
      departmentId: randomUUID(),
      positionId,
      workModel: "OFFICE",
    });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("INVALID_DEPARTMENT");
  });

  it("enforces the DRAFT -> ACTIVE -> TERMINATED lifecycle and locks the login on termination", async () => {
    const email = `lifecycle.${randomUUID()}@test.local`;
    const create = await authed("post", "/api/v1/employees").send({
      email,
      joinDate: "2026-01-01",
      departmentId,
      positionId,
      workModel: "OFFICE",
    });
    const employeeId = create.body.data.id;

    // Cannot skip straight to INACTIVE from DRAFT.
    const invalid = await authed("post", `/api/v1/employees/${employeeId}/deactivate`);
    expect(invalid.status).toBe(409);
    expect(invalid.body.error.code).toBe("INVALID_STATUS_TRANSITION");

    const activate = await authed("post", `/api/v1/employees/${employeeId}/activate`);
    expect(activate.status).toBe(200);
    expect(activate.body.data.status).toBe("ACTIVE");

    const terminate = await authed("post", `/api/v1/employees/${employeeId}/terminate`);
    expect(terminate.status).toBe(200);
    expect(terminate.body.data.status).toBe("TERMINATED");
    expect(terminate.body.data.user.status).toBe("INACTIVE");

    // TERMINATED is a terminal state — no further transitions.
    const reactivate = await authed("post", `/api/v1/employees/${employeeId}/activate`);
    expect(reactivate.status).toBe(409);

    // The linked login must be locked out.
    const loginAttempt = await request(app)
      .post("/api/v1/auth/login")
      .send({ email, password: create.body.data.temporaryPassword });
    expect(loginAttempt.status).toBe(401);
  });

  it("lets an employee view only their own record, not a colleague's", async () => {
    const passwordA = "TempPassA123!";
    const employeeA = await authed("post", "/api/v1/employees").send({
      email: `self.a.${randomUUID()}@test.local`,
      password: passwordA,
      joinDate: "2026-01-01",
      departmentId,
      positionId,
      workModel: "OFFICE",
    });
    const employeeB = await authed("post", "/api/v1/employees").send({
      email: `self.b.${randomUUID()}@test.local`,
      joinDate: "2026-01-01",
      departmentId,
      positionId,
      workModel: "OFFICE",
    });

    const loginA = await request(app)
      .post("/api/v1/auth/login")
      .send({ email: employeeA.body.data.user.email, password: passwordA });
    const tokenA = loginA.body.data.token;

    const ownRecord = await authed("get", `/api/v1/employees/${employeeA.body.data.id}`, tokenA);
    expect(ownRecord.status).toBe(200);

    const othersRecord = await authed(
      "get",
      `/api/v1/employees/${employeeB.body.data.id}`,
      tokenA,
    );
    expect(othersRecord.status).toBe(403);
    expect(othersRecord.body.error.code).toBe("FORBIDDEN");

    const list = await authed("get", "/api/v1/employees", tokenA);
    expect(list.status).toBe(403);
  });
});
