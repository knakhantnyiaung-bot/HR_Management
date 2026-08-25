import { randomUUID } from "node:crypto";
import bcrypt from "bcrypt";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@database/prisma";
import { createApp } from "../../app";

const app = createApp();

describe("positions module", () => {
  let organizationId: string;
  let departmentId: string;
  let otherDepartmentId: string;
  let hrToken: string;
  let employeeToken: string;

  function authed(method: "get" | "post" | "patch", path: string, token: string) {
    return request(app)[method](path).set("Authorization", `Bearer ${token}`);
  }

  beforeAll(async () => {
    const org = await prisma.organization.create({ data: { name: `Test Org ${randomUUID()}` } });
    organizationId = org.id;

    const department = await prisma.department.create({
      data: { organizationId, name: "Engineering" },
    });
    departmentId = department.id;
    const otherDepartment = await prisma.department.create({
      data: { organizationId, name: "Quality Assurance" },
    });
    otherDepartmentId = otherDepartment.id;

    const hrPasswordHash = await bcrypt.hash("HrPassword123!", 10);
    await prisma.user.create({
      data: { organizationId, email: "hr@test.local", passwordHash: hrPasswordHash, role: "HR_ADMIN" },
    });
    const hrLogin = await request(app)
      .post("/api/v1/auth/login")
      .send({ email: "hr@test.local", password: "HrPassword123!" });
    hrToken = hrLogin.body.data.token;

    const bootstrapPosition = await prisma.position.create({
      data: { organizationId, departmentId, title: "Bootstrap Role" },
    });
    const empPasswordHash = await bcrypt.hash("EmpPassword123!", 10);
    const employeeUser = await prisma.user.create({
      data: { organizationId, email: "worker@test.local", passwordHash: empPasswordHash, role: "EMPLOYEE" },
    });
    await prisma.employee.create({
      data: {
        organizationId,
        userId: employeeUser.id,
        employeeNo: "EMP-POS-1",
        joinDate: new Date(),
        departmentId,
        positionId: bootstrapPosition.id,
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

  it("lets HR create a position under a valid department and rejects an unknown one", async () => {
    const create = await authed("post", "/api/v1/positions", hrToken).send({
      title: "Software Engineer",
      departmentId,
    });
    expect(create.status).toBe(201);
    expect(create.body.data.status).toBe("ACTIVE");

    const invalid = await authed("post", "/api/v1/positions", hrToken).send({
      title: "Ghost Role",
      departmentId: randomUUID(),
    });
    expect(invalid.status).toBe(400);
    expect(invalid.body.error.code).toBe("INVALID_DEPARTMENT");
  });

  it("forbids an Employee from creating a position but allows listing filtered by department", async () => {
    const create = await authed("post", "/api/v1/positions", employeeToken).send({
      title: "Sales Rep",
      departmentId,
    });
    expect(create.status).toBe(403);

    const list = await authed("get", `/api/v1/positions?departmentId=${departmentId}`, employeeToken);
    expect(list.status).toBe(200);
    expect(
      list.body.data.every((p: { departmentId: string }) => p.departmentId === departmentId),
    ).toBe(true);
  });

  it("moves a position to another department and rejects an invalid status transition", async () => {
    const create = await authed("post", "/api/v1/positions", hrToken).send({
      title: "QA Engineer",
      departmentId,
    });
    const positionId = create.body.data.id;

    const move = await authed("patch", `/api/v1/positions/${positionId}`, hrToken).send({
      departmentId: otherDepartmentId,
    });
    expect(move.status).toBe(200);
    expect(move.body.data.departmentId).toBe(otherDepartmentId);

    const reactivateNoop = await authed("patch", `/api/v1/positions/${positionId}`, hrToken).send({
      status: "ACTIVE",
    });
    expect(reactivateNoop.status).toBe(409);
    expect(reactivateNoop.body.error.code).toBe("INVALID_STATUS_TRANSITION");
  });

  it("deactivates a position via PATCH status and audits it", async () => {
    const create = await authed("post", "/api/v1/positions", hrToken).send({
      title: "Temp Role",
      departmentId,
    });
    const positionId = create.body.data.id;

    const deactivate = await authed("patch", `/api/v1/positions/${positionId}`, hrToken).send({
      status: "INACTIVE",
    });
    expect(deactivate.status).toBe(200);
    expect(deactivate.body.data.status).toBe("INACTIVE");

    const audit = await prisma.auditLog.findFirst({
      where: { organizationId, action: "POSITION_UPDATED", resourceId: positionId },
    });
    expect(audit).not.toBeNull();
  });
});
