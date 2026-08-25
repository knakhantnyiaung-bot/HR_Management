import { randomUUID } from "node:crypto";
import bcrypt from "bcrypt";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@database/prisma";
import { createApp } from "../../app";

const app = createApp();

describe("departments module", () => {
  let organizationId: string;
  let hrToken: string;
  let employeeToken: string;

  function authed(method: "get" | "post" | "patch", path: string, token: string) {
    return request(app)[method](path).set("Authorization", `Bearer ${token}`);
  }

  beforeAll(async () => {
    const org = await prisma.organization.create({ data: { name: `Test Org ${randomUUID()}` } });
    organizationId = org.id;

    const hrPasswordHash = await bcrypt.hash("HrPassword123!", 10);
    await prisma.user.create({
      data: { organizationId, email: "hr@test.local", passwordHash: hrPasswordHash, role: "HR_ADMIN" },
    });
    const hrLogin = await request(app)
      .post("/api/v1/auth/login")
      .send({ email: "hr@test.local", password: "HrPassword123!" });
    hrToken = hrLogin.body.data.token;

    const department = await prisma.department.create({
      data: { organizationId, name: "Bootstrap Dept" },
    });
    const position = await prisma.position.create({
      data: { organizationId, departmentId: department.id, title: "Bootstrap Role" },
    });
    const empPasswordHash = await bcrypt.hash("EmpPassword123!", 10);
    const employeeUser = await prisma.user.create({
      data: { organizationId, email: "worker@test.local", passwordHash: empPasswordHash, role: "EMPLOYEE" },
    });
    await prisma.employee.create({
      data: {
        organizationId,
        userId: employeeUser.id,
        employeeNo: "EMP-DEPT-1",
        joinDate: new Date(),
        departmentId: department.id,
        positionId: position.id,
        status: "ACTIVE",
      },
    });
    const employeeLogin = await request(app)
      .post("/api/v1/auth/login")
      .send({ email: "worker@test.local", password: "EmpPassword123!" });
    employeeToken = employeeLogin.body.data.token;
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

  it("lets HR create a department and blocks a duplicate name", async () => {
    const create = await authed("post", "/api/v1/departments", hrToken).send({ name: "Engineering" });
    expect(create.status).toBe(201);
    expect(create.body.data.status).toBe("ACTIVE");

    const duplicate = await authed("post", "/api/v1/departments", hrToken).send({ name: "Engineering" });
    expect(duplicate.status).toBe(409);
    expect(duplicate.body.error.code).toBe("DEPARTMENT_NAME_TAKEN");
  });

  it("forbids an Employee from creating a department but allows listing", async () => {
    const create = await authed("post", "/api/v1/departments", employeeToken).send({ name: "Sales" });
    expect(create.status).toBe(403);

    const list = await authed("get", "/api/v1/departments", employeeToken);
    expect(list.status).toBe(200);
    expect(list.body.data.length).toBeGreaterThan(0);
  });

  it("renames a department and rejects an invalid status transition", async () => {
    const create = await authed("post", "/api/v1/departments", hrToken).send({ name: "DevOps" });
    const departmentId = create.body.data.id;

    const rename = await authed("patch", `/api/v1/departments/${departmentId}`, hrToken).send({
      name: "DevOps & Infrastructure",
    });
    expect(rename.status).toBe(200);
    expect(rename.body.data.name).toBe("DevOps & Infrastructure");

    const reactivateNoop = await authed("patch", `/api/v1/departments/${departmentId}`, hrToken).send({
      status: "ACTIVE",
    });
    expect(reactivateNoop.status).toBe(409);
    expect(reactivateNoop.body.error.code).toBe("INVALID_STATUS_TRANSITION");
  });

  it("deactivates a department via PATCH status and audits it", async () => {
    const create = await authed("post", "/api/v1/departments", hrToken).send({ name: "Temp Dept" });
    const departmentId = create.body.data.id;

    const deactivate = await authed("patch", `/api/v1/departments/${departmentId}`, hrToken).send({
      status: "INACTIVE",
    });
    expect(deactivate.status).toBe(200);
    expect(deactivate.body.data.status).toBe("INACTIVE");

    const doubleDeactivate = await authed(
      "patch",
      `/api/v1/departments/${departmentId}`,
      hrToken,
    ).send({ status: "INACTIVE" });
    expect(doubleDeactivate.status).toBe(409);

    const audit = await prisma.auditLog.findFirst({
      where: { organizationId, action: "DEPARTMENT_UPDATED", resourceId: departmentId },
    });
    expect(audit).not.toBeNull();
  });

  it("404s updating a department that doesn't exist in this organization", async () => {
    const res = await authed("patch", `/api/v1/departments/${randomUUID()}`, hrToken).send({
      name: "Ghost",
    });
    expect(res.status).toBe(404);
  });
});
