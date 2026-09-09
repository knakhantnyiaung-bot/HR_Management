import { randomUUID } from "node:crypto";
import bcrypt from "bcrypt";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@database/prisma";
import { createApp } from "../../app";

const app = createApp();

describe("recruitment module", () => {
  let organizationId: string;
  let departmentId: string;
  let positionId: string;
  let hrToken: string;
  let hiringManagerToken: string;
  let hiringManagerUserId: string;
  let postingId: string;

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

    const hrPasswordHash = await bcrypt.hash("HrPassword123!", 10);
    await prisma.user.create({
      data: { organizationId, email: "hr@test.local", passwordHash: hrPasswordHash, role: "HR_ADMIN" },
    });
    const hrLogin = await request(app)
      .post("/api/v1/auth/login")
      .send({ email: "hr@test.local", password: "HrPassword123!" });
    hrToken = hrLogin.body.data.token;

    const hmPasswordHash = await bcrypt.hash("HmPassword123!", 10);
    const hiringManager = await prisma.user.create({
      data: {
        organizationId,
        email: "hiring-manager@test.local",
        passwordHash: hmPasswordHash,
        role: "HIRING_MANAGER",
      },
    });
    hiringManagerUserId = hiringManager.id;
    const hmLogin = await request(app)
      .post("/api/v1/auth/login")
      .send({ email: "hiring-manager@test.local", password: "HmPassword123!" });
    hiringManagerToken = hmLogin.body.data.token;

    const posting = await authed("post", "/api/v1/recruitment/postings", hrToken).send({
      title: "Backend Engineer",
      departmentId,
      positionId,
      employmentType: "FULL_TIME",
      openings: 1,
    });
    postingId = posting.body.data.id;
  });

  afterAll(async () => {
    await prisma.auditLog.deleteMany({ where: { organizationId } });
    await prisma.notification.deleteMany({ where: { organizationId } });
    await prisma.notificationEvent.deleteMany({ where: { organizationId } });
    await prisma.offer.deleteMany({ where: { application: { jobPosting: { organizationId } } } });
    await prisma.interview.deleteMany({ where: { application: { jobPosting: { organizationId } } } });
    await prisma.candidateApplication.deleteMany({ where: { jobPosting: { organizationId } } });
    await prisma.candidate.deleteMany({ where: { organizationId } });
    await prisma.jobPosting.deleteMany({ where: { organizationId } });
    await prisma.employee.deleteMany({ where: { organizationId } });
    await prisma.user.deleteMany({ where: { organizationId } });
    await prisma.position.deleteMany({ where: { organizationId } });
    await prisma.department.deleteMany({ where: { organizationId } });
    await prisma.organization.delete({ where: { id: organizationId } });
    await prisma.$disconnect();
  });

  it("full pipeline: candidate -> assign -> stage advance -> offer -> accept -> convert", async () => {
    const candidateEmail = `candidate.${randomUUID()}@example.com`;

    const created = await authed("post", `/api/v1/recruitment/postings/${postingId}/candidates`, hrToken)
      .field("fullName", "Jane Doe")
      .field("email", candidateEmail);
    expect(created.status).toBe(201);
    const applicationId = created.body.data.id;
    expect(created.body.data.stage).toBe("APPLIED");

    // REC-03 — duplicate open application to the same posting is rejected.
    const duplicate = await authed(
      "post",
      `/api/v1/recruitment/postings/${postingId}/candidates`,
      hrToken,
    )
      .field("fullName", "Jane Doe")
      .field("email", candidateEmail);
    expect(duplicate.status).toBe(409);
    expect(duplicate.body.error.code).toBe("DUPLICATE_APPLICATION");

    const assign = await authed("patch", `/api/v1/recruitment/applications/${applicationId}/assign`, hrToken).send({
      hiringManagerUserId,
    });
    expect(assign.status).toBe(200);

    // Hiring Manager can advance up to INTERVIEW but not to OFFER (REC-06).
    const toScreening = await authed(
      "patch",
      `/api/v1/recruitment/applications/${applicationId}/stage`,
      hiringManagerToken,
    ).send({ stage: "SCREENING" });
    expect(toScreening.status).toBe(200);

    const toInterview = await authed(
      "patch",
      `/api/v1/recruitment/applications/${applicationId}/stage`,
      hiringManagerToken,
    ).send({ stage: "INTERVIEW" });
    expect(toInterview.status).toBe(200);

    const toOfferByHm = await authed(
      "patch",
      `/api/v1/recruitment/applications/${applicationId}/stage`,
      hiringManagerToken,
    ).send({ stage: "OFFER" });
    expect(toOfferByHm.status).toBe(403);

    // HIRED is never reachable via the generic stage endpoint.
    const toHired = await authed(
      "patch",
      `/api/v1/recruitment/applications/${applicationId}/stage`,
      hrToken,
    ).send({ stage: "HIRED" });
    expect(toHired.status).toBe(400);

    const interview = await authed(
      "post",
      `/api/v1/recruitment/applications/${applicationId}/interviews`,
      hiringManagerToken,
    ).send({ scheduledAt: "2026-11-15T09:00:00.000Z", mode: "REMOTE" });
    expect(interview.status).toBe(201);

    const offer = await authed("post", `/api/v1/recruitment/applications/${applicationId}/offer`, hrToken).send({
      proposedSalary: 1_500_000,
      currency: "MMK",
      startDate: "2026-12-01",
    });
    expect(offer.status).toBe(201);
    expect(offer.body.data.status).toBe("SENT");
    const offerId = offer.body.data.id;

    const refreshedApplication = await authed(
      "get",
      `/api/v1/recruitment/applications?jobPostingId=${postingId}`,
      hrToken,
    );
    const applicationAfterOffer = refreshedApplication.body.data.find(
      (a: { id: string }) => a.id === applicationId,
    );
    expect(applicationAfterOffer.stage).toBe("OFFER");

    const respond = await authed(
      "post",
      `/api/v1/recruitment/applications/${applicationId}/offer/${offerId}/respond`,
      hrToken,
    ).send({ status: "ACCEPTED" });
    expect(respond.status).toBe(200);
    expect(respond.body.data.status).toBe("ACCEPTED");

    const convert = await authed(
      "post",
      `/api/v1/recruitment/applications/${applicationId}/convert`,
      hrToken,
    );
    expect(convert.status).toBe(200);
    expect(convert.body.data.application.stage).toBe("HIRED");
    expect(typeof convert.body.data.temporaryPassword).toBe("string");
    expect(convert.body.data.temporaryPassword.length).toBeGreaterThan(0);

    const newEmployeeLogin = await request(app)
      .post("/api/v1/auth/login")
      .send({ email: candidateEmail, password: convert.body.data.temporaryPassword });
    expect(newEmployeeLogin.status).toBe(200);

    // HANDOFF-06 — cannot convert an already-converted application again.
    const secondConvert = await authed(
      "post",
      `/api/v1/recruitment/applications/${applicationId}/convert`,
      hrToken,
    );
    expect(secondConvert.status).toBe(409);
    expect(secondConvert.body.error.code).toBe("CONVERSION_NOT_ELIGIBLE");
  });

  it("forbids a Hiring Manager from acting on an application not assigned to them (REC-06)", async () => {
    const created = await authed("post", `/api/v1/recruitment/postings/${postingId}/candidates`, hrToken)
      .field("fullName", "Unassigned Candidate")
      .field("email", `unassigned.${randomUUID()}@example.com`);
    const applicationId = created.body.data.id;

    const res = await authed(
      "patch",
      `/api/v1/recruitment/applications/${applicationId}/stage`,
      hiringManagerToken,
    ).send({ stage: "SCREENING" });
    expect(res.status).toBe(403);
  });
});
