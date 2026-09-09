import { randomUUID } from "node:crypto";
import bcrypt from "bcrypt";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@database/prisma";
import { createApp } from "../../app";

const app = createApp();

describe("courses module (LMS-01..07)", () => {
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

    const email = `worker.courses.${randomUUID()}@test.local`;
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
    await prisma.auditLog.deleteMany({ where: { organizationId } });
    await prisma.courseEnrollment.deleteMany({ where: { course: { organizationId } } });
    await prisma.course.deleteMany({ where: { organizationId } });
    await prisma.employee.deleteMany({ where: { organizationId } });
    await prisma.user.deleteMany({ where: { organizationId } });
    await prisma.position.deleteMany({ where: { organizationId } });
    await prisma.department.deleteMany({ where: { organizationId } });
    await prisma.organization.delete({ where: { id: organizationId } });
    await prisma.$disconnect();
  });

  it("creates a course (HR only) and lists it in the catalog", async () => {
    const forbidden = await authed("post", "/api/v1/courses", employeeToken).send({
      title: "Should be forbidden",
      externalUrl: "https://example.com/course",
    });
    expect(forbidden.status).toBe(403);

    const create = await authed("post", "/api/v1/courses", hrToken).send({
      title: "Intro to Security",
      description: "Security awareness basics",
      externalUrl: "https://example.com/security-101",
      category: "Compliance",
    });
    expect(create.status).toBe(201);
    expect(create.body.data.status).toBe("ACTIVE");

    const list = await authed("get", "/api/v1/courses", employeeToken);
    expect(list.status).toBe(200);
    expect(list.body.data.map((c: { id: string }) => c.id)).toContain(create.body.data.id);
  });

  it("full enrollment lifecycle: enroll -> duplicate rejected -> complete -> re-complete is idempotent", async () => {
    const create = await authed("post", "/api/v1/courses", hrToken).send({
      title: "Onboarding 101",
      externalUrl: "https://example.com/onboarding",
    });
    const courseId = create.body.data.id;

    const enroll = await authed("post", `/api/v1/courses/${courseId}/enroll`, employeeToken);
    expect(enroll.status).toBe(201);
    expect(enroll.body.data.completedAt).toBeNull();

    const duplicateEnroll = await authed("post", `/api/v1/courses/${courseId}/enroll`, employeeToken);
    expect(duplicateEnroll.status).toBe(409);
    expect(duplicateEnroll.body.error.code).toBe("ALREADY_ENROLLED");

    const complete = await authed("post", `/api/v1/courses/${courseId}/complete`, employeeToken);
    expect(complete.status).toBe(200);
    expect(complete.body.data.completedAt).not.toBeNull();

    // Completing again is a no-op success, not an error.
    const recomplete = await authed("post", `/api/v1/courses/${courseId}/complete`, employeeToken);
    expect(recomplete.status).toBe(200);

    const list = await authed(
      "get",
      `/api/v1/courses/enrollments?courseId=${courseId}`,
      employeeToken,
    );
    expect(list.status).toBe(200);
    expect(list.body.data).toHaveLength(1);
  });

  it("rejects marking a course complete before enrolling, and rejects enrolling in an archived course", async () => {
    const create = await authed("post", "/api/v1/courses", hrToken).send({
      title: "Archived Course",
      externalUrl: "https://example.com/archived",
    });
    const courseId = create.body.data.id;

    const completeWithoutEnroll = await authed(
      "post",
      `/api/v1/courses/${courseId}/complete`,
      employeeToken,
    );
    expect(completeWithoutEnroll.status).toBe(409);
    expect(completeWithoutEnroll.body.error.code).toBe("NOT_ENROLLED");

    await authed("patch", `/api/v1/courses/${courseId}`, hrToken).send({ status: "ARCHIVED" });

    const enrollArchived = await authed("post", `/api/v1/courses/${courseId}/enroll`, employeeToken);
    expect(enrollArchived.status).toBe(409);
    expect(enrollArchived.body.error.code).toBe("COURSE_NOT_ACTIVE");
  });

  it("bulk-enrolls all active employees (HR only) and scopes enrollment visibility to own records", async () => {
    const create = await authed("post", "/api/v1/courses", hrToken).send({
      title: "Mandatory Training",
      externalUrl: "https://example.com/mandatory",
      mandatory: true,
    });
    const courseId = create.body.data.id;

    const forbidden = await authed(
      "post",
      `/api/v1/courses/${courseId}/enroll-all-active`,
      employeeToken,
    );
    expect(forbidden.status).toBe(403);

    const bulk = await authed("post", `/api/v1/courses/${courseId}/enroll-all-active`, hrToken);
    expect(bulk.status).toBe(200);
    expect(bulk.body.data.newlyEnrolled).toBeGreaterThan(0);

    // Idempotent — calling again enrolls nobody new.
    const bulkAgain = await authed("post", `/api/v1/courses/${courseId}/enroll-all-active`, hrToken);
    expect(bulkAgain.body.data.newlyEnrolled).toBe(0);

    const ownView = await authed(
      "get",
      `/api/v1/courses/enrollments?courseId=${courseId}`,
      employeeToken,
    );
    expect(ownView.status).toBe(200);
    expect(ownView.body.data.every((e: { employeeId: string }) => e.employeeId === employeeId)).toBe(true);

    const hrView = await authed("get", `/api/v1/courses/enrollments?courseId=${courseId}`, hrToken);
    expect(hrView.body.data.length).toBeGreaterThanOrEqual(ownView.body.data.length);
  });
});
