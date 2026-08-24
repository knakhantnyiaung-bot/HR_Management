import { randomUUID } from "node:crypto";
import bcrypt from "bcrypt";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@database/prisma";
import { createApp } from "../../app";

const app = createApp();

describe("attendance module", () => {
  let organizationId: string;
  let hrToken: string;
  let employeeToken: string;
  let employeeId: string;

  beforeAll(async () => {
    const org = await prisma.organization.create({
      data: { name: `Test Org ${randomUUID()}`, timezone: "Asia/Yangon" },
    });
    organizationId = org.id;

    const department = await prisma.department.create({
      data: { organizationId, name: "Engineering" },
    });
    const position = await prisma.position.create({
      data: { organizationId, departmentId: department.id, title: "Software Engineer" },
    });

    const hrPasswordHash = await bcrypt.hash("HrPassword123!", 10);
    await prisma.user.create({
      data: { organizationId, email: "hr@test.local", passwordHash: hrPasswordHash, role: "HR_ADMIN" },
    });
    const hrLogin = await request(app)
      .post("/api/v1/auth/login")
      .send({ email: "hr@test.local", password: "HrPassword123!" });
    hrToken = hrLogin.body.data.token;

    const empPasswordHash = await bcrypt.hash("EmpPassword123!", 10);
    const employeeUser = await prisma.user.create({
      data: {
        organizationId,
        email: "worker@test.local",
        passwordHash: empPasswordHash,
        role: "EMPLOYEE",
      },
    });
    const employee = await prisma.employee.create({
      data: {
        organizationId,
        userId: employeeUser.id,
        employeeNo: "EMP-9001",
        joinDate: new Date(),
        departmentId: department.id,
        positionId: position.id,
        workModel: "OFFICE",
        status: "ACTIVE",
      },
    });
    employeeId = employee.id;

    const employeeLogin = await request(app)
      .post("/api/v1/auth/login")
      .send({ email: "worker@test.local", password: "EmpPassword123!" });
    employeeToken = employeeLogin.body.data.token;
  });

  afterAll(async () => {
    await prisma.auditLog.deleteMany({ where: { organizationId } });
    await prisma.attendanceRecord.deleteMany({ where: { organizationId } });
    await prisma.employee.deleteMany({ where: { organizationId } });
    await prisma.user.deleteMany({ where: { organizationId } });
    await prisma.position.deleteMany({ where: { organizationId } });
    await prisma.department.deleteMany({ where: { organizationId } });
    await prisma.organization.delete({ where: { id: organizationId } });
    await prisma.$disconnect();
  });

  function authed(method: "get" | "post", path: string, token: string) {
    return request(app)[method](path).set("Authorization", `Bearer ${token}`);
  }

  it("checks in and rejects a second check-in while a session is open", async () => {
    const first = await authed("post", "/api/v1/attendance/check-in", employeeToken);
    expect(first.status).toBe(201);
    expect(first.body.data.checkOut).toBeNull();
    expect(first.body.data.employee.id).toBe(employeeId);

    const duplicate = await authed("post", "/api/v1/attendance/check-in", employeeToken);
    expect(duplicate.status).toBe(409);
    expect(duplicate.body.error.code).toBe("ATTENDANCE_ALREADY_OPEN");
  });

  it("rejects check-out with no open session, then checks out and computes duration", async () => {
    // The open session from the previous test needs to be closed first so
    // this test starts from a clean NO_SESSION state.
    await authed("post", "/api/v1/attendance/check-out", employeeToken);

    const noSession = await authed("post", "/api/v1/attendance/check-out", employeeToken);
    expect(noSession.status).toBe(409);
    expect(noSession.body.error.code).toBe("NO_OPEN_ATTENDANCE_SESSION");

    await authed("post", "/api/v1/attendance/check-in", employeeToken);
    const checkOut = await authed("post", "/api/v1/attendance/check-out", employeeToken);
    expect(checkOut.status).toBe(200);
    expect(checkOut.body.data.checkOut).not.toBeNull();
    expect(typeof checkOut.body.data.workingMinutes).toBe("number");
  });

  it("scopes GET /attendance to the caller's own records for an Employee", async () => {
    const res = await authed("get", "/api/v1/attendance", employeeToken);
    expect(res.status).toBe(200);
    expect(res.body.data.length).toBeGreaterThan(0);
    expect(res.body.data.every((r: { employee: { id: string } }) => r.employee.id === employeeId)).toBe(
      true,
    );
  });

  it("lets HR correct a record with a mandatory reason and audits it", async () => {
    const record = await prisma.attendanceRecord.create({
      data: {
        organizationId,
        employeeId,
        workDate: new Date(`${new Intl.DateTimeFormat("en-CA").format(new Date())}T00:00:00.000Z`),
        checkIn: new Date(Date.now() - 60 * 60 * 1000),
      },
    });
    const recordId = record.id;

    const missingReason = await authed("post", `/api/v1/attendance/${recordId}/correct`, hrToken)
      .send({ checkOut: new Date().toISOString() });
    expect(missingReason.status).toBe(400);

    const corrected = await request(app)
      .post(`/api/v1/attendance/${recordId}/correct`)
      .set("Authorization", `Bearer ${hrToken}`)
      .send({ checkOut: new Date().toISOString(), reason: "Forgot to check out on time" });
    expect(corrected.status).toBe(200);
    expect(corrected.body.data.correctionNote).toBe("Forgot to check out on time");

    const audit = await prisma.auditLog.findFirst({
      where: { organizationId, action: "ATTENDANCE_CORRECTED", resourceId: recordId },
    });
    expect(audit).not.toBeNull();
  });

  it("forbids an Employee from correcting attendance", async () => {
    const record = await prisma.attendanceRecord.create({
      data: {
        organizationId,
        employeeId,
        workDate: new Date(`${new Intl.DateTimeFormat("en-CA").format(new Date())}T00:00:00.000Z`),
        checkIn: new Date(Date.now() - 60 * 60 * 1000),
      },
    });
    const recordId = record.id;

    const res = await request(app)
      .post(`/api/v1/attendance/${recordId}/correct`)
      .set("Authorization", `Bearer ${employeeToken}`)
      .send({ checkOut: new Date().toISOString(), reason: "self-correction attempt" });
    expect(res.status).toBe(403);

    // The rejected correction never set checkOut — close the session out of
    // band so this record doesn't leak an open session into later tests.
    await prisma.attendanceRecord.update({ where: { id: recordId }, data: { checkOut: new Date() } });
  });

  it("blocks check-in for a non-active employee", async () => {
    await prisma.employee.update({ where: { id: employeeId }, data: { status: "INACTIVE" } });

    const res = await authed("post", "/api/v1/attendance/check-in", employeeToken);
    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe("EMPLOYEE_NOT_ACTIVE");

    await prisma.employee.update({ where: { id: employeeId }, data: { status: "ACTIVE" } });
  });

  it("computes the business date from the organization timezone, not server local time", async () => {
    const res = await authed("post", "/api/v1/attendance/check-in", employeeToken);
    expect(res.status).toBe(201);

    const expected = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Yangon" }).format(
      new Date(),
    );
    expect(res.body.data.workDate.slice(0, 10)).toBe(expected);

    await authed("post", "/api/v1/attendance/check-out", employeeToken);
  });
});
