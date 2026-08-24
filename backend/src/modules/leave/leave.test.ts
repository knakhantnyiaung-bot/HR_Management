import { randomUUID } from "node:crypto";
import bcrypt from "bcrypt";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@database/prisma";
import { createApp } from "../../app";

const app = createApp();

describe("leave module", () => {
  let organizationId: string;
  let departmentId: string;
  let positionId: string;
  let hrToken: string;
  let paidLeaveTypeId: string;
  let unpaidLeaveTypeId: string;

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
    return { employeeId, token: login.body.data.token as string, email };
  }

  function authed(method: "get" | "post", path: string, token: string) {
    return request(app)[method](path).set("Authorization", `Bearer ${token}`);
  }

  async function grantBalance(employeeId: string, leaveTypeId: string, period: string, entitled: number) {
    return authed("post", "/api/v1/leave/balances", hrToken).send({
      employeeId,
      leaveTypeId,
      period,
      entitled,
    });
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

    const paidType = await authed("post", "/api/v1/leave/types", hrToken).send({
      name: "Annual Leave",
      paid: true,
    });
    paidLeaveTypeId = paidType.body.data.id;

    const unpaidType = await authed("post", "/api/v1/leave/types", hrToken).send({
      name: "Unpaid Leave",
      paid: false,
    });
    unpaidLeaveTypeId = unpaidType.body.data.id;
  });

  afterAll(async () => {
    await prisma.auditLog.deleteMany({ where: { organizationId } });
    await prisma.leaveRequest.deleteMany({ where: { employee: { organizationId } } });
    await prisma.leaveBalance.deleteMany({ where: { employee: { organizationId } } });
    await prisma.leaveType.deleteMany({ where: { organizationId } });
    await prisma.employee.deleteMany({ where: { organizationId } });
    await prisma.user.deleteMany({ where: { organizationId } });
    await prisma.position.deleteMany({ where: { organizationId } });
    await prisma.department.deleteMany({ where: { organizationId } });
    await prisma.organization.delete({ where: { id: organizationId } });
    await prisma.$disconnect();
  });

  it("lets an employee request leave, HR approve it, and consumes the balance exactly once", async () => {
    const { employeeId, token } = await createActiveEmployee("worker.approve", "EmpPassword123!");
    await grantBalance(employeeId, paidLeaveTypeId, "2026", 10);

    const create = await authed("post", "/api/v1/leave/requests", token).send({
      leaveTypeId: paidLeaveTypeId,
      startDate: "2026-03-02",
      endDate: "2026-03-04",
    });
    expect(create.status).toBe(201);
    expect(create.body.data.status).toBe("PENDING");
    expect(create.body.data.days).toBe("3");

    const requestId = create.body.data.id;

    const approve = await authed("post", `/api/v1/leave/requests/${requestId}/approve`, hrToken);
    expect(approve.status).toBe(200);
    expect(approve.body.data.status).toBe("APPROVED");

    const balances = await authed(
      "get",
      `/api/v1/leave/balances?employeeId=${employeeId}&period=2026`,
      hrToken,
    );
    const balance = balances.body.data.find(
      (b: { leaveTypeId: string }) => b.leaveTypeId === paidLeaveTypeId,
    );
    expect(balance.used).toBe("3");
    expect(balance.remaining).toBe("7");

    const audit = await prisma.auditLog.findFirst({
      where: { organizationId, action: "LEAVE_REQUEST_APPROVED", resourceId: requestId },
    });
    expect(audit).not.toBeNull();
  });

  it("rejects an overlapping leave request", async () => {
    const { employeeId, token } = await createActiveEmployee("worker.overlap", "EmpPassword123!");
    await grantBalance(employeeId, paidLeaveTypeId, "2026", 10);

    const first = await authed("post", "/api/v1/leave/requests", token).send({
      leaveTypeId: paidLeaveTypeId,
      startDate: "2026-04-10",
      endDate: "2026-04-12",
    });
    expect(first.status).toBe(201);

    const overlapping = await authed("post", "/api/v1/leave/requests", token).send({
      leaveTypeId: paidLeaveTypeId,
      startDate: "2026-04-11",
      endDate: "2026-04-15",
    });
    expect(overlapping.status).toBe(409);
    expect(overlapping.body.error.code).toBe("LEAVE_OVERLAP");
  });

  it("rejects approval with LEAVE_BALANCE_INSUFFICIENT when the balance is too low", async () => {
    const { employeeId, token } = await createActiveEmployee("worker.insufficient", "EmpPassword123!");
    await grantBalance(employeeId, paidLeaveTypeId, "2026", 1);

    const create = await authed("post", "/api/v1/leave/requests", token).send({
      leaveTypeId: paidLeaveTypeId,
      startDate: "2026-05-01",
      endDate: "2026-05-05",
    });
    expect(create.status).toBe(201);

    const approve = await authed(
      "post",
      `/api/v1/leave/requests/${create.body.data.id}/approve`,
      hrToken,
    );
    expect(approve.status).toBe(422);
    expect(approve.body.error.code).toBe("LEAVE_BALANCE_INSUFFICIENT");
  });

  it("approves unpaid leave without touching any balance", async () => {
    const { employeeId, token } = await createActiveEmployee("worker.unpaid", "EmpPassword123!");
    // Deliberately no balance grant — unpaid leave shouldn't need one.

    const create = await authed("post", "/api/v1/leave/requests", token).send({
      leaveTypeId: unpaidLeaveTypeId,
      startDate: "2026-06-01",
      endDate: "2026-06-02",
    });
    expect(create.status).toBe(201);

    const approve = await authed(
      "post",
      `/api/v1/leave/requests/${create.body.data.id}/approve`,
      hrToken,
    );
    expect(approve.status).toBe(200);
    expect(approve.body.data.status).toBe("APPROVED");

    const balances = await authed("get", `/api/v1/leave/balances?employeeId=${employeeId}`, hrToken);
    expect(balances.body.data).toHaveLength(0);
  });

  it("restores the balance exactly once when an approved request is cancelled", async () => {
    const { employeeId, token } = await createActiveEmployee("worker.cancel", "EmpPassword123!");
    await grantBalance(employeeId, paidLeaveTypeId, "2026", 10);

    const create = await authed("post", "/api/v1/leave/requests", token).send({
      leaveTypeId: paidLeaveTypeId,
      startDate: "2026-07-01",
      endDate: "2026-07-03",
    });
    const requestId = create.body.data.id;
    await authed("post", `/api/v1/leave/requests/${requestId}/approve`, hrToken);

    const cancel = await authed("post", `/api/v1/leave/requests/${requestId}/cancel`, hrToken);
    expect(cancel.status).toBe(200);
    expect(cancel.body.data.status).toBe("CANCELLED");

    const balances = await authed(
      "get",
      `/api/v1/leave/balances?employeeId=${employeeId}&period=2026`,
      hrToken,
    );
    const balance = balances.body.data.find(
      (b: { leaveTypeId: string }) => b.leaveTypeId === paidLeaveTypeId,
    );
    expect(balance.used).toBe("0");
    expect(balance.remaining).toBe("10");

    // Cancelling again must not restore the balance a second time.
    const secondCancel = await authed(
      "post",
      `/api/v1/leave/requests/${requestId}/cancel`,
      hrToken,
    );
    expect(secondCancel.status).toBe(409);
  });

  it("lets an employee cancel their own pending request but not a colleague's", async () => {
    const a = await createActiveEmployee("worker.own.a", "EmpPassword123!");
    const b = await createActiveEmployee("worker.own.b", "EmpPassword123!");

    const create = await authed("post", "/api/v1/leave/requests", a.token).send({
      leaveTypeId: unpaidLeaveTypeId,
      startDate: "2026-08-01",
      endDate: "2026-08-01",
    });
    const requestId = create.body.data.id;

    const otherCancels = await authed(
      "post",
      `/api/v1/leave/requests/${requestId}/cancel`,
      b.token,
    );
    expect(otherCancels.status).toBe(403);

    const ownCancels = await authed(
      "post",
      `/api/v1/leave/requests/${requestId}/cancel`,
      a.token,
    );
    expect(ownCancels.status).toBe(200);
    expect(ownCancels.body.data.status).toBe("CANCELLED");
  });

  it("prevents double-spending a shared balance when two requests are approved concurrently", async () => {
    const { employeeId, token } = await createActiveEmployee("worker.race", "EmpPassword123!");
    await grantBalance(employeeId, paidLeaveTypeId, "2026", 5);

    const [reqA, reqB] = await Promise.all([
      authed("post", "/api/v1/leave/requests", token).send({
        leaveTypeId: paidLeaveTypeId,
        startDate: "2026-09-01",
        endDate: "2026-09-03",
      }),
      authed("post", "/api/v1/leave/requests", token).send({
        leaveTypeId: paidLeaveTypeId,
        startDate: "2026-10-01",
        endDate: "2026-10-03",
      }),
    ]);
    expect(reqA.status).toBe(201);
    expect(reqB.status).toBe(201);

    // Both requests are 3 days against a 5-day balance — sequentially the
    // second must fail, and that must hold even when approved concurrently.
    const [approveA, approveB] = await Promise.all([
      authed("post", `/api/v1/leave/requests/${reqA.body.data.id}/approve`, hrToken),
      authed("post", `/api/v1/leave/requests/${reqB.body.data.id}/approve`, hrToken),
    ]);
    const statuses = [approveA.status, approveB.status].sort();
    expect(statuses).toEqual([200, 422]);

    const balances = await authed(
      "get",
      `/api/v1/leave/balances?employeeId=${employeeId}&period=2026`,
      hrToken,
    );
    const balance = balances.body.data.find(
      (bal: { leaveTypeId: string }) => bal.leaveTypeId === paidLeaveTypeId,
    );
    // Exactly one 3-day approval landed — not zero, not two.
    expect(balance.used).toBe("3");
    expect(balance.remaining).toBe("2");
  });
});
