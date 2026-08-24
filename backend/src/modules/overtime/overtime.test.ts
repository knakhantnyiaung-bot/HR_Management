import { randomUUID } from "node:crypto";
import bcrypt from "bcrypt";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@database/prisma";
import { createApp } from "../../app";

const app = createApp();

describe("overtime module", () => {
  let organizationId: string;
  let departmentId: string;
  let positionId: string;
  let hrToken: string;

  async function createActiveEmployee(emailPrefix: string, password: string) {
    const email = `${emailPrefix}.${randomUUID()}@test.local`;
    const create = await request(app)
      .post("/api/v1/employees")
      .set("Authorization", `Bearer ${hrToken}`)
      .send({ email, password, joinDate: "2026-01-01", departmentId, positionId, workModel: "OFFICE" });
    const employeeId = create.body.data.id;
    await request(app)
      .post(`/api/v1/employees/${employeeId}/activate`)
      .set("Authorization", `Bearer ${hrToken}`);
    const login = await request(app).post("/api/v1/auth/login").send({ email, password });
    return { employeeId, token: login.body.data.token as string };
  }

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

    const hrPasswordHash = await bcrypt.hash("HrPassword123!", 10);
    await prisma.user.create({
      data: { organizationId, email: "hr@test.local", passwordHash: hrPasswordHash, role: "HR_ADMIN" },
    });
    const hrLogin = await request(app)
      .post("/api/v1/auth/login")
      .send({ email: "hr@test.local", password: "HrPassword123!" });
    hrToken = hrLogin.body.data.token;
  });

  afterAll(async () => {
    await prisma.auditLog.deleteMany({ where: { organizationId } });
    await prisma.overtimeRequest.deleteMany({ where: { employee: { organizationId } } });
    await prisma.employee.deleteMany({ where: { organizationId } });
    await prisma.user.deleteMany({ where: { organizationId } });
    await prisma.position.deleteMany({ where: { organizationId } });
    await prisma.department.deleteMany({ where: { organizationId } });
    await prisma.organization.delete({ where: { id: organizationId } });
    await prisma.$disconnect();
  });

  it("creates a request with a server-computed hours total and default multiplier, then HR approves it", async () => {
    const { token } = await createActiveEmployee("worker.approve", "EmpPassword123!");

    const create = await authed("post", "/api/v1/overtime/requests", token).send({
      workDate: "2026-03-02",
      startTime: "2026-03-02T18:00:00.000Z",
      endTime: "2026-03-02T21:30:00.000Z",
    });
    expect(create.status).toBe(201);
    expect(create.body.data.status).toBe("PENDING");
    expect(create.body.data.hours).toBe("3.5");
    expect(create.body.data.multiplier).toBe("1.5");

    const requestId = create.body.data.id;
    const approve = await authed("post", `/api/v1/overtime/requests/${requestId}/approve`, hrToken);
    expect(approve.status).toBe(200);
    expect(approve.body.data.status).toBe("APPROVED");
    expect(approve.body.data.approvedBy).toBeTruthy();

    const audit = await prisma.auditLog.findFirst({
      where: { organizationId, action: "OVERTIME_REQUEST_APPROVED", resourceId: requestId },
    });
    expect(audit).not.toBeNull();
  });

  it("rejects an overlapping overtime request but allows back-to-back windows", async () => {
    const { token } = await createActiveEmployee("worker.overlap", "EmpPassword123!");

    const first = await authed("post", "/api/v1/overtime/requests", token).send({
      workDate: "2026-04-10",
      startTime: "2026-04-10T18:00:00.000Z",
      endTime: "2026-04-10T21:00:00.000Z",
    });
    expect(first.status).toBe(201);

    const overlapping = await authed("post", "/api/v1/overtime/requests", token).send({
      workDate: "2026-04-10",
      startTime: "2026-04-10T20:00:00.000Z",
      endTime: "2026-04-10T22:00:00.000Z",
    });
    expect(overlapping.status).toBe(409);
    expect(overlapping.body.error.code).toBe("OVERTIME_OVERLAP");

    // Exactly back-to-back (21:00 -> 21:00) is not an overlap.
    const backToBack = await authed("post", "/api/v1/overtime/requests", token).send({
      workDate: "2026-04-10",
      startTime: "2026-04-10T21:00:00.000Z",
      endTime: "2026-04-10T23:00:00.000Z",
    });
    expect(backToBack.status).toBe(201);
  });

  it("lets HR reject a request", async () => {
    const { token } = await createActiveEmployee("worker.reject", "EmpPassword123!");

    const create = await authed("post", "/api/v1/overtime/requests", token).send({
      workDate: "2026-05-01",
      startTime: "2026-05-01T18:00:00.000Z",
      endTime: "2026-05-01T20:00:00.000Z",
    });

    const reject = await authed(
      "post",
      `/api/v1/overtime/requests/${create.body.data.id}/reject`,
      hrToken,
    );
    expect(reject.status).toBe(200);
    expect(reject.body.data.status).toBe("REJECTED");
  });

  it("lets an employee cancel their own pending request but not a colleague's", async () => {
    const a = await createActiveEmployee("worker.own.a", "EmpPassword123!");
    const b = await createActiveEmployee("worker.own.b", "EmpPassword123!");

    const create = await authed("post", "/api/v1/overtime/requests", a.token).send({
      workDate: "2026-06-01",
      startTime: "2026-06-01T18:00:00.000Z",
      endTime: "2026-06-01T20:00:00.000Z",
    });
    const requestId = create.body.data.id;

    const otherCancels = await authed(
      "post",
      `/api/v1/overtime/requests/${requestId}/cancel`,
      b.token,
    );
    expect(otherCancels.status).toBe(403);

    const ownCancels = await authed(
      "post",
      `/api/v1/overtime/requests/${requestId}/cancel`,
      a.token,
    );
    expect(ownCancels.status).toBe(200);
    expect(ownCancels.body.data.status).toBe("CANCELLED");
  });

  it("treats APPROVED as terminal — cannot be cancelled, even by HR", async () => {
    const { token } = await createActiveEmployee("worker.terminal", "EmpPassword123!");

    const create = await authed("post", "/api/v1/overtime/requests", token).send({
      workDate: "2026-07-01",
      startTime: "2026-07-01T18:00:00.000Z",
      endTime: "2026-07-01T20:00:00.000Z",
    });
    const requestId = create.body.data.id;
    await authed("post", `/api/v1/overtime/requests/${requestId}/approve`, hrToken);

    const hrCancel = await authed("post", `/api/v1/overtime/requests/${requestId}/cancel`, hrToken);
    expect(hrCancel.status).toBe(409);
    expect(hrCancel.body.error.code).toBe("INVALID_STATUS_TRANSITION");
  });

  it("scopes GET /overtime/requests to the caller's own records for an Employee", async () => {
    const { token, employeeId } = await createActiveEmployee("worker.list", "EmpPassword123!");
    await authed("post", "/api/v1/overtime/requests", token).send({
      workDate: "2026-08-01",
      startTime: "2026-08-01T18:00:00.000Z",
      endTime: "2026-08-01T20:00:00.000Z",
    });

    const res = await authed("get", "/api/v1/overtime/requests", token);
    expect(res.status).toBe(200);
    expect(res.body.data.length).toBeGreaterThan(0);
    expect(
      res.body.data.every((r: { employee: { id: string } }) => r.employee.id === employeeId),
    ).toBe(true);
  });

  it("allows exactly one of two concurrent approvals on the same request to succeed", async () => {
    const { token } = await createActiveEmployee("worker.race", "EmpPassword123!");

    const create = await authed("post", "/api/v1/overtime/requests", token).send({
      workDate: "2026-09-01",
      startTime: "2026-09-01T18:00:00.000Z",
      endTime: "2026-09-01T20:00:00.000Z",
    });
    const requestId = create.body.data.id;

    const [first, second] = await Promise.all([
      authed("post", `/api/v1/overtime/requests/${requestId}/approve`, hrToken),
      authed("post", `/api/v1/overtime/requests/${requestId}/approve`, hrToken),
    ]);
    const statuses = [first.status, second.status].sort();
    expect(statuses).toEqual([200, 409]);

    const auditCount = await prisma.auditLog.count({
      where: { organizationId, action: "OVERTIME_REQUEST_APPROVED", resourceId: requestId },
    });
    expect(auditCount).toBe(1);
  });
});
