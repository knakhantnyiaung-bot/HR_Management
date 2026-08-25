import { randomUUID } from "node:crypto";
import bcrypt from "bcrypt";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@database/prisma";
import { createApp } from "../../app";

const app = createApp();

describe("organizations module", () => {
  let organizationId: string;
  let departmentId: string;
  let positionId: string;
  let superAdminToken: string;
  let hrToken: string;
  let employeeToken: string;

  function authed(method: "get" | "post" | "patch", path: string, token: string) {
    return request(app)[method](path).set("Authorization", `Bearer ${token}`);
  }

  async function login(email: string, password: string) {
    const res = await request(app).post("/api/v1/auth/login").send({ email, password });
    return res.body.data.token as string;
  }

  beforeAll(async () => {
    const org = await prisma.organization.create({
      data: { name: `Test Org ${randomUUID()}`, currency: "MMK" },
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

    const superAdminHash = await bcrypt.hash("SuperPassword123!", 10);
    await prisma.user.create({
      data: {
        organizationId,
        email: "super@test.local",
        passwordHash: superAdminHash,
        role: "SUPER_ADMIN",
      },
    });
    superAdminToken = await login("super@test.local", "SuperPassword123!");

    const hrHash = await bcrypt.hash("HrPassword123!", 10);
    await prisma.user.create({
      data: { organizationId, email: "hr@test.local", passwordHash: hrHash, role: "HR_ADMIN" },
    });
    hrToken = await login("hr@test.local", "HrPassword123!");

    const empHash = await bcrypt.hash("EmpPassword123!", 10);
    const employeeUser = await prisma.user.create({
      data: { organizationId, email: "worker@test.local", passwordHash: empHash, role: "EMPLOYEE" },
    });
    await prisma.employee.create({
      data: {
        organizationId,
        userId: employeeUser.id,
        employeeNo: "EMP-ORG-1",
        joinDate: new Date(),
        departmentId,
        positionId,
        status: "ACTIVE",
      },
    });
    employeeToken = await login("worker@test.local", "EmpPassword123!");
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

  it("lets HR read but not write organization settings", async () => {
    const get = await authed("get", "/api/v1/organization", hrToken);
    expect(get.status).toBe(200);
    expect(get.body.data.id).toBe(organizationId);

    const patch = await authed("patch", "/api/v1/organization", hrToken).send({
      name: "Should Not Apply",
    });
    expect(patch.status).toBe(403);
  });

  it("blocks an Employee from organization settings entirely", async () => {
    const get = await authed("get", "/api/v1/organization", employeeToken);
    expect(get.status).toBe(403);
  });

  it("lets Super Admin update organization settings and audits it", async () => {
    const patch = await authed("patch", "/api/v1/organization", superAdminToken).send({
      timezone: "Asia/Bangkok",
    });
    expect(patch.status).toBe(200);
    expect(patch.body.data.timezone).toBe("Asia/Bangkok");

    const audit = await prisma.auditLog.findFirst({
      where: { organizationId, action: "ORGANIZATION_UPDATED" },
    });
    expect(audit).not.toBeNull();
  });

  it("blocks a currency change once payroll history exists", async () => {
    const run = await prisma.payrollRun.create({
      data: { organizationId, period: "2029-01", status: "DRAFT" },
    });

    const patch = await authed("patch", "/api/v1/organization", superAdminToken).send({
      currency: "USD",
    });
    expect(patch.status).toBe(409);
    expect(patch.body.error.code).toBe("CURRENCY_CHANGE_BLOCKED");

    await prisma.payrollRun.delete({ where: { id: run.id } });
  });
});
