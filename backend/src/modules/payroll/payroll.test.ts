import { randomUUID } from "node:crypto";
import bcrypt from "bcrypt";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@database/prisma";
import { createApp } from "../../app";

const app = createApp();
const PERIOD = "2026-09";

describe("payroll module", () => {
  let organizationId: string;
  let departmentId: string;
  let positionId: string;
  let hrToken: string;
  let employeeToken: string;
  let unpaidLeaveTypeId: string;

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
    const login = await request(app).post("/api/v1/auth/login").send({ email, password });
    return { employeeId, token: login.body.data.token as string };
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

    const unpaidType = await authed("post", "/api/v1/leave/types", hrToken).send({
      name: "Unpaid Leave",
      paid: false,
    });
    unpaidLeaveTypeId = unpaidType.body.data.id;

    // Deliberately left un-activated (stays DRAFT) rather than reusing
    // createActiveEmployee: this employee only exists to hold an EMPLOYEE-
    // role token for RBAC checks, and if it were ACTIVE it would be
    // eligible for every payroll calculation in this org — which would
    // then fail with SALARY_PROFILE_MISSING since it never gets one.
    const email = `worker.rbac.${randomUUID()}@test.local`;
    const password = "EmpPassword123!";
    await request(app)
      .post("/api/v1/employees")
      .set("Authorization", `Bearer ${hrToken}`)
      .send({ email, password, joinDate: "2026-01-01", departmentId, positionId, workModel: "OFFICE" });
    const login = await request(app).post("/api/v1/auth/login").send({ email, password });
    employeeToken = login.body.data.token;
  });

  afterAll(async () => {
    await prisma.auditLog.deleteMany({ where: { organizationId } });
    await prisma.payslip.deleteMany({ where: { payrollItem: { employee: { organizationId } } } });
    await prisma.payrollItem.deleteMany({ where: { employee: { organizationId } } });
    await prisma.payrollRun.deleteMany({ where: { organizationId } });
    await prisma.leaveRequest.deleteMany({ where: { employee: { organizationId } } });
    await prisma.overtimeRequest.deleteMany({ where: { employee: { organizationId } } });
    await prisma.salaryProfile.deleteMany({ where: { employee: { organizationId } } });
    await prisma.leaveType.deleteMany({ where: { organizationId } });
    await prisma.employee.deleteMany({ where: { organizationId } });
    await prisma.user.deleteMany({ where: { organizationId } });
    await prisma.position.deleteMany({ where: { organizationId } });
    await prisma.department.deleteMany({ where: { organizationId } });
    await prisma.organization.delete({ where: { id: organizationId } });
    await prisma.$disconnect();
  });

  it("runs the full DRAFT -> CALCULATED -> APPROVED -> PAID lifecycle with correct numbers", async () => {
    const { employeeId, token } = await createActiveEmployee("worker.lifecycle", "EmpPassword123!");

    await authed("patch", `/api/v1/employees/${employeeId}/salary-profile`, hrToken).send({
      basicSalary: 1_000_000,
      allowances: { transport: 50_000 },
      otSettings: { standardMonthlyHours: 200, standardWorkingDays: 25 },
    });

    const ot = await authed("post", "/api/v1/overtime/requests", token).send({
      workDate: "2026-09-05",
      startTime: "2026-09-05T18:00:00.000Z",
      endTime: "2026-09-05T22:00:00.000Z", // 4 hours
    });
    await authed("post", `/api/v1/overtime/requests/${ot.body.data.id}/approve`, hrToken);

    const leave = await authed("post", "/api/v1/leave/requests", token).send({
      leaveTypeId: unpaidLeaveTypeId,
      startDate: "2026-09-10",
      endDate: "2026-09-11", // 2 days
    });
    await authed("post", `/api/v1/leave/requests/${leave.body.data.id}/approve`, hrToken);

    const create = await authed("post", "/api/v1/payroll/runs", hrToken).send({ period: PERIOD });
    expect(create.status).toBe(201);
    expect(create.body.data.status).toBe("DRAFT");
    const runId = create.body.data.id;

    const calculate = await authed("post", `/api/v1/payroll/runs/${runId}/calculate`, hrToken);
    expect(calculate.status).toBe(200);
    expect(calculate.body.data.status).toBe("CALCULATED");

    const item = calculate.body.data.items.find(
      (i: { employeeId: string }) => i.employeeId === employeeId,
    );
    // hourlyRate = 1,000,000/200 = 5,000; OT = 5,000 * 4h * 1.5 = 30,000
    // dailyRate = 1,000,000/25 = 40,000; unpaid leave = 40,000 * 2d = 80,000
    // gross = 1,000,000 + 50,000 allowance + 30,000 OT = 1,080,000
    // deductions = 80,000 unpaid leave; net = 1,000,000
    expect(item.gross).toBe("1080000");
    expect(item.deductions).toBe("80000");
    expect(item.net).toBe("1000000");

    const get = await authed("get", `/api/v1/payroll/runs/${runId}`, hrToken);
    expect(get.status).toBe(200);
    expect(get.body.data.items).toHaveLength(1);

    const approve = await authed("post", `/api/v1/payroll/runs/${runId}/approve`, hrToken);
    expect(approve.status).toBe(200);
    expect(approve.body.data.status).toBe("APPROVED");
    expect(approve.body.data.approvedBy).toBeTruthy();

    // Approved runs don't recalculate.
    const recalcAttempt = await authed("post", `/api/v1/payroll/runs/${runId}/calculate`, hrToken);
    expect(recalcAttempt.status).toBe(409);
    expect(recalcAttempt.body.error.code).toBe("INVALID_STATUS_TRANSITION");

    const markPaid = await authed("post", `/api/v1/payroll/runs/${runId}/mark-paid`, hrToken);
    expect(markPaid.status).toBe(200);
    expect(markPaid.body.data.status).toBe("PAID");
    expect(markPaid.body.data.paidAt).toBeTruthy();

    const doubleMarkPaid = await authed(
      "post",
      `/api/v1/payroll/runs/${runId}/mark-paid`,
      hrToken,
    );
    expect(doubleMarkPaid.status).toBe(409);

    const actions = await prisma.auditLog.findMany({
      where: { organizationId, resourceType: "PayrollRun", resourceId: runId },
      select: { action: true },
    });
    const actionNames = actions.map((a) => a.action).sort();
    expect(actionNames).toEqual(
      [
        "PAYROLL_RUN_APPROVED",
        "PAYROLL_RUN_CALCULATED",
        "PAYROLL_RUN_CREATED",
        "PAYROLL_RUN_MARKED_PAID",
        "PAYSLIPS_RELEASED",
      ].sort(),
    );

    const payslip = await prisma.payslip.findFirst({
      where: { payrollItem: { payrollRunId: runId, employeeId } },
    });
    expect(payslip).not.toBeNull();

    const ownPayslips = await authed("get", "/api/v1/payslips", token);
    expect(ownPayslips.status).toBe(200);
    expect(ownPayslips.body.data).toHaveLength(1);
    expect(ownPayslips.body.data[0].id).toBe(payslip!.id);

    const getOwn = await authed("get", `/api/v1/payslips/${payslip!.id}`, token);
    expect(getOwn.status).toBe(200);
    expect(getOwn.body.data.payrollItem.employee.id).toBe(employeeId);
  });

  it("rejects creating a second run for the same period", async () => {
    const duplicate = await authed("post", "/api/v1/payroll/runs", hrToken).send({
      period: PERIOD,
    });
    expect(duplicate.status).toBe(409);
    expect(duplicate.body.error.code).toBe("PAYROLL_RUN_ALREADY_EXISTS");
  });

  it("aborts calculation entirely (no partial items) when an eligible employee has no salary profile", async () => {
    // Deliberately no salary profile for this employee.
    const { employeeId } = await createActiveEmployee("worker.nosalary", "EmpPassword123!");

    const create = await authed("post", "/api/v1/payroll/runs", hrToken).send({
      period: "2026-10",
    });
    const runId = create.body.data.id;

    const calculate = await authed("post", `/api/v1/payroll/runs/${runId}/calculate`, hrToken);
    expect(calculate.status).toBe(422);
    expect(calculate.body.error.code).toBe("SALARY_PROFILE_MISSING");

    const itemCount = await prisma.payrollItem.count({ where: { payrollRunId: runId } });
    expect(itemCount).toBe(0);

    // Retire this fixture so it doesn't keep tripping SALARY_PROFILE_MISSING
    // for every other period this org calculates for the rest of the suite.
    await authed("post", `/api/v1/employees/${employeeId}/deactivate`, hrToken);
    const run = await prisma.payrollRun.findUniqueOrThrow({ where: { id: runId } });
    expect(run.status).toBe("DRAFT");
  });

  it("blocks an Employee from every payroll route", async () => {
    const create = await authed("post", "/api/v1/payroll/runs", employeeToken).send({
      period: "2026-11",
    });
    expect(create.status).toBe(403);

    const list = await authed("get", "/api/v1/payroll/runs", employeeToken);
    expect(list.status).toBe(403);
  });

  it("allows exactly one of two concurrent approvals on the same run to succeed", async () => {
    const { employeeId } = await createActiveEmployee("worker.race", "EmpPassword123!");
    await authed("patch", `/api/v1/employees/${employeeId}/salary-profile`, hrToken).send({
      basicSalary: 500_000,
    });

    const create = await authed("post", "/api/v1/payroll/runs", hrToken).send({
      period: "2026-12",
    });
    const runId = create.body.data.id;
    await authed("post", `/api/v1/payroll/runs/${runId}/calculate`, hrToken);

    const [first, second] = await Promise.all([
      authed("post", `/api/v1/payroll/runs/${runId}/approve`, hrToken),
      authed("post", `/api/v1/payroll/runs/${runId}/approve`, hrToken),
    ]);
    const statuses = [first.status, second.status].sort();
    expect(statuses).toEqual([200, 409]);

    const approvedAuditCount = await prisma.auditLog.count({
      where: { organizationId, action: "PAYROLL_RUN_APPROVED", resourceId: runId },
    });
    expect(approvedAuditCount).toBe(1);
  });
});
