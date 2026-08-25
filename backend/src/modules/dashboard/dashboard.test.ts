import { randomUUID } from "node:crypto";
import bcrypt from "bcrypt";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@database/prisma";
import { createApp } from "../../app";

const app = createApp();

// Matches dashboard.service's currentPayrollPeriod: the run must be for
// *this* calendar month for the HR dashboard to pick it up as "current".
function currentPayrollPeriod(): string {
  const now = new Date();
  return `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}`;
}

describe("dashboard module", () => {
  let organizationId: string;
  let departmentId: string;
  let positionId: string;
  let hrToken: string;
  let paidLeaveTypeId: string;
  let unpaidLeaveTypeId: string;
  let employeeAId: string;
  let employeeAToken: string;
  let employeeBId: string;
  let employeeBToken: string;

  function authed(method: "get" | "post" | "patch", path: string, token: string) {
    return request(app)[method](path).set("Authorization", `Bearer ${token}`);
  }

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
    await authed("patch", `/api/v1/employees/${employeeId}/salary-profile`, hrToken).send({
      basicSalary: 500_000,
    });
    const login = await request(app).post("/api/v1/auth/login").send({ email, password });
    return { employeeId, token: login.body.data.token as string };
  }

  beforeAll(async () => {
    const org = await prisma.organization.create({
      data: { name: `Test Org ${randomUUID()}`, timezone: "Asia/Yangon" },
    });
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

    const employeeA = await createActiveEmployee("worker.dashboard.a", "EmpPassword123!");
    employeeAId = employeeA.employeeId;
    employeeAToken = employeeA.token;

    const employeeB = await createActiveEmployee("worker.dashboard.b", "EmpPassword123!");
    employeeBId = employeeB.employeeId;
    employeeBToken = employeeB.token;

    await authed("post", "/api/v1/leave/balances", hrToken).send({
      employeeId: employeeAId,
      leaveTypeId: paidLeaveTypeId,
      period: String(new Date().getUTCFullYear()),
      entitled: 10,
    });

    // Employee A: present today (open check-in), one pending leave request,
    // one pending OT request.
    await authed("post", "/api/v1/attendance/check-in", employeeAToken);
    await authed("post", "/api/v1/leave/requests", employeeAToken).send({
      leaveTypeId: paidLeaveTypeId,
      startDate: "2030-01-10",
      endDate: "2030-01-11",
    });
    await authed("post", "/api/v1/overtime/requests", employeeAToken).send({
      workDate: "2026-01-05",
      startTime: "2026-01-05T18:00:00.000Z",
      endTime: "2026-01-05T20:00:00.000Z",
    });

    // Employee B: approved unpaid leave covering today. Matches the
    // organization's Asia/Yangon business date, same as dashboard.service's
    // getBusinessDate — not the server/UTC date, which can disagree near
    // midnight UTC.
    const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Yangon" }).format(new Date());
    const leaveRequest = await authed("post", "/api/v1/leave/requests", employeeB.token).send({
      leaveTypeId: unpaidLeaveTypeId,
      startDate: today,
      endDate: today,
    });
    await authed("post", `/api/v1/leave/requests/${leaveRequest.body.data.id}/approve`, hrToken);

    // Release a payslip for the current month so /dashboard/me has one to report.
    const period = currentPayrollPeriod();
    const run = await authed("post", "/api/v1/payroll/runs", hrToken).send({ period });
    const runId = run.body.data.id;
    await authed("post", `/api/v1/payroll/runs/${runId}/calculate`, hrToken);
    await authed("post", `/api/v1/payroll/runs/${runId}/approve`, hrToken);
  });

  afterAll(async () => {
    await prisma.auditLog.deleteMany({ where: { organizationId } });
    await prisma.payslip.deleteMany({ where: { payrollItem: { employee: { organizationId } } } });
    await prisma.payrollItem.deleteMany({ where: { employee: { organizationId } } });
    await prisma.payrollRun.deleteMany({ where: { organizationId } });
    await prisma.leaveRequest.deleteMany({ where: { employee: { organizationId } } });
    await prisma.leaveBalance.deleteMany({ where: { employee: { organizationId } } });
    await prisma.overtimeRequest.deleteMany({ where: { employee: { organizationId } } });
    await prisma.salaryProfile.deleteMany({ where: { employee: { organizationId } } });
    await prisma.attendanceRecord.deleteMany({ where: { organizationId } });
    await prisma.leaveType.deleteMany({ where: { organizationId } });
    await prisma.employee.deleteMany({ where: { organizationId } });
    await prisma.user.deleteMany({ where: { organizationId } });
    await prisma.position.deleteMany({ where: { organizationId } });
    await prisma.department.deleteMany({ where: { organizationId } });
    await prisma.organization.delete({ where: { id: organizationId } });
    await prisma.$disconnect();
  });

  it("reports org-wide operational metrics on the HR dashboard", async () => {
    const res = await authed("get", "/api/v1/dashboard/hr", hrToken);
    expect(res.status).toBe(200);

    expect(res.body.data.activeEmployees).toBe(2);
    expect(res.body.data.presentToday).toBe(1);
    expect(res.body.data.onLeave).toBe(1);
    expect(res.body.data.pendingLeave).toBe(1);
    expect(res.body.data.pendingOT).toBe(1);
    expect(res.body.data.currentPayroll).toEqual({ period: currentPayrollPeriod(), status: "APPROVED" });
    expect(res.body.data.payrollCost.label).toBe("net");
    expect(typeof res.body.data.payrollCost.amount).toBe("number");
    expect(res.body.data.payrollCost.amount).toBeGreaterThan(0);
  });

  it("blocks an Employee from the HR dashboard", async () => {
    const res = await authed("get", "/api/v1/dashboard/hr", employeeAToken);
    expect(res.status).toBe(403);
  });

  it("reports the caller's own state on the Employee dashboard", async () => {
    const res = await authed("get", "/api/v1/dashboard/me", employeeAToken);
    expect(res.status).toBe(200);

    expect(res.body.data.attendanceToday).not.toBeNull();
    expect(res.body.data.attendanceToday.checkOut).toBeNull();

    const balance = res.body.data.leaveBalances.find(
      (b: { leaveTypeId: string }) => b.leaveTypeId === paidLeaveTypeId,
    );
    expect(balance).toBeTruthy();
    expect(balance.entitled).toBe("10");

    expect(res.body.data.pendingRequests).toEqual({ leave: 1, overtime: 1 });

    expect(res.body.data.latestPayslip).not.toBeNull();
    expect(res.body.data.latestPayslip.payrollItem.employee.id).toBe(employeeAId);
  });

  it("scopes the Employee dashboard to a different caller's own data", async () => {
    const res = await authed("get", "/api/v1/dashboard/me", employeeBToken);
    expect(res.status).toBe(200);

    // B never checked in and has no pending requests, unlike A.
    expect(res.body.data.attendanceToday).toBeNull();
    expect(res.body.data.pendingRequests).toEqual({ leave: 0, overtime: 0 });
    expect(res.body.data.leaveBalances).toHaveLength(0);

    expect(res.body.data.latestPayslip).not.toBeNull();
    expect(res.body.data.latestPayslip.payrollItem.employee.id).toBe(employeeBId);
  });
});
