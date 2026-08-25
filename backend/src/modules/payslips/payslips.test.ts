import { randomUUID } from "node:crypto";
import bcrypt from "bcrypt";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@database/prisma";
import { createApp } from "../../app";

const app = createApp();
const PERIOD = "2027-01";

describe("payslips module", () => {
  let organizationId: string;
  let departmentId: string;
  let positionId: string;
  let hrToken: string;

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
      basicSalary: 600_000,
    });
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
  });

  afterAll(async () => {
    await prisma.auditLog.deleteMany({ where: { organizationId } });
    await prisma.payslip.deleteMany({ where: { payrollItem: { employee: { organizationId } } } });
    await prisma.payrollItem.deleteMany({ where: { employee: { organizationId } } });
    await prisma.payrollRun.deleteMany({ where: { organizationId } });
    await prisma.salaryProfile.deleteMany({ where: { employee: { organizationId } } });
    await prisma.employee.deleteMany({ where: { organizationId } });
    await prisma.user.deleteMany({ where: { organizationId } });
    await prisma.position.deleteMany({ where: { organizationId } });
    await prisma.department.deleteMany({ where: { organizationId } });
    await prisma.organization.delete({ where: { id: organizationId } });
    await prisma.$disconnect();
  });

  it("releases one payslip per employee on payroll approval, visible only to HR and the owning employee", async () => {
    const employeeA = await createActiveEmployee("worker.payslip.a", "EmpPassword123!");
    const employeeB = await createActiveEmployee("worker.payslip.b", "EmpPassword123!");

    const create = await authed("post", "/api/v1/payroll/runs", hrToken).send({ period: PERIOD });
    const runId = create.body.data.id;
    await authed("post", `/api/v1/payroll/runs/${runId}/calculate`, hrToken);

    // Not yet released: the run is still CALCULATED, not APPROVED.
    const beforeApproval = await authed("get", `/api/v1/payslips?period=${PERIOD}`, hrToken);
    expect(beforeApproval.body.data).toHaveLength(0);

    await authed("post", `/api/v1/payroll/runs/${runId}/approve`, hrToken);

    const hrList = await authed("get", `/api/v1/payslips?period=${PERIOD}`, hrToken);
    expect(hrList.status).toBe(200);
    expect(hrList.body.data).toHaveLength(2);

    const hrFiltered = await authed(
      "get",
      `/api/v1/payslips?employeeId=${employeeA.employeeId}`,
      hrToken,
    );
    expect(hrFiltered.body.data).toHaveLength(1);
    const payslipA = hrFiltered.body.data[0];
    expect(payslipA.payrollItem.employee.id).toBe(employeeA.employeeId);

    // Employee A sees only their own payslip in the list...
    const ownList = await authed("get", "/api/v1/payslips", employeeA.token);
    expect(ownList.status).toBe(200);
    expect(ownList.body.data).toHaveLength(1);
    expect(ownList.body.data[0].id).toBe(payslipA.id);

    // ...can fetch it directly...
    const ownGet = await authed("get", `/api/v1/payslips/${payslipA.id}`, employeeA.token);
    expect(ownGet.status).toBe(200);

    // ...but not Employee B's, even by direct id (404, not 403 — existence
    // of another employee's payslip must not be confirmed).
    const crossAccess = await authed("get", `/api/v1/payslips/${payslipA.id}`, employeeB.token);
    expect(crossAccess.status).toBe(404);
  });
});
