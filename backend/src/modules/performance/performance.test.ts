import { randomUUID } from "node:crypto";
import bcrypt from "bcrypt";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@database/prisma";
import { createApp } from "../../app";

const app = createApp();

describe("performance module (PERF-01..07)", () => {
  let organizationId: string;
  let departmentId: string;
  let positionId: string;
  let hrToken: string;
  let managerEmployeeId: string;
  let managerToken: string;
  let reportEmployeeId: string;
  let reportToken: string;

  function authed(method: "get" | "post" | "patch", path: string, token: string) {
    return request(app)[method](path).set("Authorization", `Bearer ${token}`);
  }

  async function createActiveEmployee(emailPrefix: string) {
    const email = `${emailPrefix}.${randomUUID()}@test.local`;
    const password = "EmpPassword123!";
    const create = await authed("post", "/api/v1/employees", hrToken).send({
      email,
      password,
      joinDate: "2026-01-01",
      departmentId,
      positionId,
      workModel: "OFFICE",
    });
    const employeeId = create.body.data.id as string;
    await authed("post", `/api/v1/employees/${employeeId}/activate`, hrToken);
    const login = await request(app).post("/api/v1/auth/login").send({ email, password });
    return { employeeId, token: login.body.data.token as string };
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

    const manager = await createActiveEmployee("manager");
    managerEmployeeId = manager.employeeId;
    managerToken = manager.token;

    const report = await createActiveEmployee("report");
    reportEmployeeId = report.employeeId;
    reportToken = report.token;

    const assignManager = await authed("patch", `/api/v1/employees/${reportEmployeeId}`, hrToken).send({
      managerId: managerEmployeeId,
    });
    expect(assignManager.status).toBe(200);
  });

  afterAll(async () => {
    await prisma.auditLog.deleteMany({ where: { organizationId } });
    await prisma.performanceReview.deleteMany({ where: { cycle: { organizationId } } });
    await prisma.performanceReviewCycle.deleteMany({ where: { organizationId } });
    await prisma.employee.deleteMany({ where: { organizationId } });
    await prisma.user.deleteMany({ where: { organizationId } });
    await prisma.position.deleteMany({ where: { organizationId } });
    await prisma.department.deleteMany({ where: { organizationId } });
    await prisma.organization.delete({ where: { id: organizationId } });
    await prisma.$disconnect();
  });

  it("rejects an employee from creating a cycle, and rejects an invalid period", async () => {
    const forbidden = await authed("post", "/api/v1/performance/cycles", reportToken).send({
      name: "Q1 2026",
      periodStart: "2026-01-01",
      periodEnd: "2026-03-31",
    });
    expect(forbidden.status).toBe(403);

    const invalidPeriod = await authed("post", "/api/v1/performance/cycles", hrToken).send({
      name: "Bad period",
      periodStart: "2026-03-31",
      periodEnd: "2026-01-01",
    });
    expect(invalidPeriod.status).toBe(400);
  });

  it("full cycle lifecycle: create -> open (bulk-creates reviews) -> self+manager review -> close blocks further submissions", async () => {
    const create = await authed("post", "/api/v1/performance/cycles", hrToken).send({
      name: "Q1 2026",
      periodStart: "2026-01-01",
      periodEnd: "2026-03-31",
    });
    expect(create.status).toBe(201);
    expect(create.body.data.status).toBe("DRAFT");
    const cycleId = create.body.data.id;

    // Submitting before the cycle opens is rejected because no review row
    // exists yet (open() is what creates them).
    const beforeOpenList = await authed(
      "get",
      `/api/v1/performance/reviews?cycleId=${cycleId}`,
      hrToken,
    );
    expect(beforeOpenList.body.data).toHaveLength(0);

    const open = await authed("post", `/api/v1/performance/cycles/${cycleId}/open`, hrToken);
    expect(open.status).toBe(200);
    expect(open.body.data.status).toBe("OPEN");

    // Re-opening (already OPEN) is rejected — also proves the bulk-create
    // above didn't need to run twice for idempotency to matter here.
    const reopen = await authed("post", `/api/v1/performance/cycles/${cycleId}/open`, hrToken);
    expect(reopen.status).toBe(409);

    const list = await authed("get", `/api/v1/performance/reviews?cycleId=${cycleId}`, hrToken);
    expect(list.status).toBe(200);
    // Bulk-created for both active employees (manager + report) plus
    // whatever HR/other fixtures exist — at least these two.
    const employeeIds = list.body.data.map((r: { employeeId: string }) => r.employeeId);
    expect(employeeIds).toContain(managerEmployeeId);
    expect(employeeIds).toContain(reportEmployeeId);

    const reportReview = list.body.data.find(
      (r: { employeeId: string }) => r.employeeId === reportEmployeeId,
    );
    expect(reportReview.status).toBe("PENDING");

    // The manager cannot submit the manager section before a self-review
    // exists is NOT a rule here (Wave 2 doesn't require ordering) — but an
    // unrelated employee (the manager here, on their own review) can only
    // touch their own self section.
    const wrongSelfSubmit = await authed(
      "patch",
      `/api/v1/performance/reviews/${reportReview.id}/self`,
      managerToken,
    ).send({ selfRating: 5 });
    expect(wrongSelfSubmit.status).toBe(403);

    const selfSubmit = await authed(
      "patch",
      `/api/v1/performance/reviews/${reportReview.id}/self`,
      reportToken,
    ).send({ selfRating: 4, selfComments: "Good quarter", goals: "Ship the thing" });
    expect(selfSubmit.status).toBe(200);
    expect(selfSubmit.body.data.status).toBe("SELF_SUBMITTED");

    // A manager who isn't this employee's manager cannot submit either.
    const wrongManagerSubmit = await authed(
      "patch",
      `/api/v1/performance/reviews/${reportReview.id}/manager`,
      reportToken,
    ).send({ managerRating: 4 });
    expect(wrongManagerSubmit.status).toBe(403);

    const managerSubmit = await authed(
      "patch",
      `/api/v1/performance/reviews/${reportReview.id}/manager`,
      managerToken,
    ).send({ managerRating: 5, managerComments: "Agreed, great quarter" });
    expect(managerSubmit.status).toBe(200);
    expect(managerSubmit.body.data.status).toBe("COMPLETED");

    // The report can see their own completed review, including the
    // manager's section.
    const ownView = await authed(
      "get",
      `/api/v1/performance/reviews/${reportReview.id}`,
      reportToken,
    );
    expect(ownView.status).toBe(200);
    expect(ownView.body.data.managerRating).toBe(5);

    const close = await authed("post", `/api/v1/performance/cycles/${cycleId}/close`, hrToken);
    expect(close.status).toBe(200);
    expect(close.body.data.status).toBe("CLOSED");

    const submitAfterClose = await authed(
      "patch",
      `/api/v1/performance/reviews/${reportReview.id}/self`,
      reportToken,
    ).send({ selfRating: 3 });
    expect(submitAfterClose.status).toBe(409);
    expect(submitAfterClose.body.error.code).toBe("CYCLE_NOT_OPEN");
  });

  it("scopes review visibility: an unrelated employee cannot see someone else's review", async () => {
    const create = await authed("post", "/api/v1/performance/cycles", hrToken).send({
      name: "Q2 2026",
      periodStart: "2026-04-01",
      periodEnd: "2026-06-30",
    });
    const cycleId = create.body.data.id;
    await authed("post", `/api/v1/performance/cycles/${cycleId}/open`, hrToken);

    const list = await authed("get", `/api/v1/performance/reviews?cycleId=${cycleId}`, hrToken);
    const reportReview = list.body.data.find(
      (r: { employeeId: string }) => r.employeeId === reportEmployeeId,
    );

    const unrelated = await createActiveEmployee("unrelated");
    const unrelatedView = await authed(
      "get",
      `/api/v1/performance/reviews/${reportReview.id}`,
      unrelated.token,
    );
    expect(unrelatedView.status).toBe(404);

    const managerView = await authed(
      "get",
      `/api/v1/performance/reviews/${reportReview.id}`,
      managerToken,
    );
    expect(managerView.status).toBe(200);
  });
});
