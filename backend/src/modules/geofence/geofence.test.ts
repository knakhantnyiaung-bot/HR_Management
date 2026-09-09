import { randomUUID } from "node:crypto";
import bcrypt from "bcrypt";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@database/prisma";
import { createApp } from "../../app";
import { haversineMeters } from "@modules/geofence/geofence.service";

const app = createApp();

describe("geofence module", () => {
  let organizationId: string;
  let departmentId: string;
  let positionId: string;
  let hrToken: string;

  async function createEmployee(
    emailPrefix: string,
    password: string,
    workModel: "OFFICE" | "HYBRID" | "REMOTE",
  ) {
    const email = `${emailPrefix}.${randomUUID()}@test.local`;
    const create = await request(app)
      .post("/api/v1/employees")
      .set("Authorization", `Bearer ${hrToken}`)
      .send({ email, password, joinDate: "2026-01-01", departmentId, positionId, workModel });
    const employeeId = create.body.data.id;
    await request(app)
      .post(`/api/v1/employees/${employeeId}/activate`)
      .set("Authorization", `Bearer ${hrToken}`);
    const login = await request(app).post("/api/v1/auth/login").send({ email, password });
    return { employeeId, token: login.body.data.token as string };
  }

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

    await authed("post", "/api/v1/organization/geofence-zones", hrToken).send({
      label: "HQ",
      lat: 16.8,
      lng: 96.15,
      radiusMeters: 200,
    });
    await authed("patch", "/api/v1/organization/geofence-policy", hrToken).send({
      locationPolicy: "GEOFENCE_ENFORCED",
    });
  });

  afterAll(async () => {
    await prisma.auditLog.deleteMany({ where: { organizationId } });
    await prisma.notification.deleteMany({ where: { organizationId } });
    await prisma.notificationEvent.deleteMany({ where: { organizationId } });
    await prisma.attendanceRecord.deleteMany({ where: { organizationId } });
    await prisma.geofenceZone.deleteMany({ where: { organizationId } });
    await prisma.employee.deleteMany({ where: { organizationId } });
    await prisma.user.deleteMany({ where: { organizationId } });
    await prisma.position.deleteMany({ where: { organizationId } });
    await prisma.department.deleteMany({ where: { organizationId } });
    await prisma.organization.delete({ where: { id: organizationId } });
    await prisma.$disconnect();
  });

  it("computes haversine distance as ~0 for identical coordinates", () => {
    expect(haversineMeters({ lat: 16.8, lng: 96.15 }, { lat: 16.8, lng: 96.15 })).toBeCloseTo(0, 3);
  });

  it("rejects an OFFICE check-in with no coordinates once GEOFENCE_ENFORCED is active (GEO-04)", async () => {
    const { token } = await createEmployee("office-nolocation", "Password123!", "OFFICE");
    const res = await authed("post", "/api/v1/attendance/check-in", token);
    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe("LOCATION_REQUIRED");
  });

  it("rejects an OFFICE check-in outside every configured zone (GEO-05)", async () => {
    const { token } = await createEmployee("office-outside", "Password123!", "OFFICE");
    const res = await authed("post", "/api/v1/attendance/check-in", token).send({
      lat: 17.5,
      lng: 97.0,
      accuracyMeters: 10,
    });
    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe("OUTSIDE_GEOFENCE");

    const record = await prisma.attendanceRecord.findFirst({ where: { organizationId } });
    expect(record).toBeNull();
  });

  it("accepts an OFFICE check-in inside a configured zone (GEO-06)", async () => {
    const { token } = await createEmployee("office-inside", "Password123!", "OFFICE");
    const res = await authed("post", "/api/v1/attendance/check-in", token).send({
      lat: 16.8001,
      lng: 96.1501,
      accuracyMeters: 10,
    });
    expect(res.status).toBe(201);
    expect(res.body.data.locationSource).toBe("GPS");
  });

  it("never rejects a REMOTE employee for location, regardless of policy (GEO-02/GEO-03)", async () => {
    const { token } = await createEmployee("remote-worker", "Password123!", "REMOTE");
    const res = await authed("post", "/api/v1/attendance/check-in", token);
    expect(res.status).toBe(201);
    expect(res.body.data.locationSource).toBe("UNAVAILABLE");
  });
});
