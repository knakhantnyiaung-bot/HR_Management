import { randomUUID } from "node:crypto";
import bcrypt from "bcrypt";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@database/prisma";
import { createApp } from "../../app";

const app = createApp();

describe("assets module (ASSET-01..08)", () => {
  let organizationId: string;
  let departmentId: string;
  let positionId: string;
  let hrToken: string;
  let employeeId: string;
  let employeeToken: string;

  function authed(method: "get" | "post" | "patch", path: string, token: string) {
    return request(app)[method](path).set("Authorization", `Bearer ${token}`);
  }

  beforeAll(async () => {
    const org = await prisma.organization.create({ data: { name: `Test Org ${randomUUID()}` } });
    organizationId = org.id;

    const department = await prisma.department.create({ data: { organizationId, name: "Engineering" } });
    departmentId = department.id;
    const position = await prisma.position.create({
      data: { organizationId, departmentId, title: "Software Engineer" },
    });
    positionId = position.id;

    const hrHash = await bcrypt.hash("HrPassword123!", 10);
    await prisma.user.create({
      data: { organizationId, email: "hr@test.local", passwordHash: hrHash, role: "HR_ADMIN" },
    });
    const hrLogin = await request(app)
      .post("/api/v1/auth/login")
      .send({ email: "hr@test.local", password: "HrPassword123!" });
    hrToken = hrLogin.body.data.token;

    const email = `worker.assets.${randomUUID()}@test.local`;
    const password = "EmpPassword123!";
    const create = await authed("post", "/api/v1/employees", hrToken).send({
      email,
      password,
      joinDate: "2026-01-01",
      departmentId,
      positionId,
      workModel: "OFFICE",
    });
    employeeId = create.body.data.id;
    await authed("post", `/api/v1/employees/${employeeId}/activate`, hrToken);
    const login = await request(app).post("/api/v1/auth/login").send({ email, password });
    employeeToken = login.body.data.token;
  });

  afterAll(async () => {
    await prisma.notification.deleteMany({ where: { organizationId } });
    await prisma.notificationEvent.deleteMany({ where: { organizationId } });
    await prisma.auditLog.deleteMany({ where: { organizationId } });
    await prisma.assetAssignment.deleteMany({ where: { asset: { organizationId } } });
    await prisma.asset.deleteMany({ where: { organizationId } });
    await prisma.employee.deleteMany({ where: { organizationId } });
    await prisma.user.deleteMany({ where: { organizationId } });
    await prisma.position.deleteMany({ where: { organizationId } });
    await prisma.department.deleteMany({ where: { organizationId } });
    await prisma.organization.delete({ where: { id: organizationId } });
    await prisma.$disconnect();
  });

  it("creates an asset and rejects a duplicate asset tag", async () => {
    const create = await authed("post", "/api/v1/assets", hrToken).send({
      assetTag: "LAPTOP-001",
      name: "MacBook Pro 14",
      category: "LAPTOP",
      serialNumber: "SN-001",
    });
    expect(create.status).toBe(201);
    expect(create.body.data.status).toBe("AVAILABLE");

    const employeeAttempt = await authed("post", "/api/v1/assets", employeeToken).send({
      assetTag: "LAPTOP-999",
      name: "Should be forbidden",
    });
    expect(employeeAttempt.status).toBe(403);

    const duplicate = await authed("post", "/api/v1/assets", hrToken).send({
      assetTag: "LAPTOP-001",
      name: "Another laptop",
    });
    expect(duplicate.status).toBe(409);
    expect(duplicate.body.error.code).toBe("ASSET_TAG_ALREADY_EXISTS");
  });

  it("full assign/return lifecycle, and rejects assigning an already-assigned asset", async () => {
    const create = await authed("post", "/api/v1/assets", hrToken).send({
      assetTag: "MON-001",
      name: "Dell Monitor 27in",
      category: "MONITOR",
    });
    const assetId = create.body.data.id;

    const assign = await authed("post", `/api/v1/assets/${assetId}/assign`, hrToken).send({
      employeeId,
    });
    expect(assign.status).toBe(200);
    expect(assign.body.data.status).toBe("ASSIGNED");
    expect(assign.body.data.currentEmployee.id).toBe(employeeId);

    const doubleAssign = await authed("post", `/api/v1/assets/${assetId}/assign`, hrToken).send({
      employeeId,
    });
    expect(doubleAssign.status).toBe(409);
    expect(doubleAssign.body.error.code).toBe("ASSET_NOT_AVAILABLE");

    // A direct status PATCH must not bypass return.
    const directPatch = await authed("patch", `/api/v1/assets/${assetId}`, hrToken).send({
      status: "IN_REPAIR",
    });
    expect(directPatch.status).toBe(409);
    expect(directPatch.body.error.code).toBe("ASSET_CURRENTLY_ASSIGNED");

    // The employee can see this asset among their own; nobody else's.
    const own = await authed("get", "/api/v1/assets", employeeToken);
    expect(own.status).toBe(200);
    expect(own.body.data.map((a: { id: string }) => a.id)).toContain(assetId);

    const returnRes = await authed("post", `/api/v1/assets/${assetId}/return`, hrToken).send({});
    expect(returnRes.status).toBe(200);
    expect(returnRes.body.data.status).toBe("AVAILABLE");
    expect(returnRes.body.data.currentEmployee).toBeNull();

    const doubleReturn = await authed("post", `/api/v1/assets/${assetId}/return`, hrToken).send({});
    expect(doubleReturn.status).toBe(409);
    expect(doubleReturn.body.error.code).toBe("ASSET_NOT_ASSIGNED");

    const history = await authed("get", `/api/v1/assets/${assetId}/assignments`, hrToken);
    expect(history.status).toBe(200);
    expect(history.body.data).toHaveLength(1);
    expect(history.body.data[0].returnedAt).not.toBeNull();
  });

  it("flags HR (via a notification) when a terminated employee still has assigned assets, without blocking termination", async () => {
    const email = `worker.terminate-with-assets.${randomUUID()}@test.local`;
    const password = "EmpPassword123!";
    const create = await authed("post", "/api/v1/employees", hrToken).send({
      email,
      password,
      joinDate: "2026-01-01",
      departmentId,
      positionId,
      workModel: "OFFICE",
    });
    const targetEmployeeId = create.body.data.id;
    await authed("post", `/api/v1/employees/${targetEmployeeId}/activate`, hrToken);

    const asset = await authed("post", "/api/v1/assets", hrToken).send({
      assetTag: "PHONE-001",
      name: "Company Phone",
      category: "PHONE",
    });
    await authed("post", `/api/v1/assets/${asset.body.data.id}/assign`, hrToken).send({
      employeeId: targetEmployeeId,
    });

    const terminate = await authed(
      "post",
      `/api/v1/employees/${targetEmployeeId}/terminate`,
      hrToken,
    );
    expect(terminate.status).toBe(200);
    expect(terminate.body.data.status).toBe("TERMINATED");

    // The asset itself is untouched — termination never auto-returns.
    const stillAssigned = await prisma.asset.findUniqueOrThrow({ where: { id: asset.body.data.id } });
    expect(stillAssigned.status).toBe("ASSIGNED");
    expect(stillAssigned.currentEmployeeId).toBe(targetEmployeeId);

    const event = await prisma.notificationEvent.findFirst({
      where: { organizationId, eventType: "asset.employee_terminated_with_assets" },
      orderBy: { createdAt: "desc" },
    });
    expect(event).not.toBeNull();
  });
});
