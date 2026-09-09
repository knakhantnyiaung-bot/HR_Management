import { randomUUID } from "node:crypto";
import bcrypt from "bcrypt";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@database/prisma";
import { createApp } from "../../app";

const app = createApp();

describe("careers module (CAREER-01..10)", () => {
  let organizationId: string;
  let orgSlug: string;
  let departmentId: string;
  let positionId: string;
  let superAdminToken: string;
  let hrToken: string;
  let openPostingId: string;
  let draftPostingId: string;

  function authed(method: "get" | "post" | "patch", path: string, token: string) {
    return request(app)[method](path).set("Authorization", `Bearer ${token}`);
  }

  function publicReq(method: "get" | "post", path: string) {
    return request(app)[method](path);
  }

  beforeAll(async () => {
    const org = await prisma.organization.create({ data: { name: `Test Org ${randomUUID()}` } });
    organizationId = org.id;
    orgSlug = `test-org-${randomUUID()}`;

    const department = await prisma.department.create({ data: { organizationId, name: "Engineering" } });
    departmentId = department.id;
    const position = await prisma.position.create({
      data: { organizationId, departmentId, title: "Software Engineer" },
    });
    positionId = position.id;

    const superAdminHash = await bcrypt.hash("SuperPassword123!", 10);
    await prisma.user.create({
      data: { organizationId, email: "super@test.local", passwordHash: superAdminHash, role: "SUPER_ADMIN" },
    });
    const superLogin = await request(app)
      .post("/api/v1/auth/login")
      .send({ email: "super@test.local", password: "SuperPassword123!" });
    superAdminToken = superLogin.body.data.token;

    const hrHash = await bcrypt.hash("HrPassword123!", 10);
    await prisma.user.create({
      data: { organizationId, email: "hr@test.local", passwordHash: hrHash, role: "HR_ADMIN" },
    });
    const hrLogin = await request(app)
      .post("/api/v1/auth/login")
      .send({ email: "hr@test.local", password: "HrPassword123!" });
    hrToken = hrLogin.body.data.token;

    const enable = await authed("patch", "/api/v1/organization", superAdminToken).send({
      careersSlug: orgSlug,
      careersEnabled: true,
    });
    expect(enable.status).toBe(200);

    const openPosting = await authed("post", "/api/v1/recruitment/postings", hrToken).send({
      title: "Backend Engineer",
      departmentId,
      positionId,
      employmentType: "FULL_TIME",
      openings: 2,
    });
    openPostingId = openPosting.body.data.id;
    await authed("patch", `/api/v1/recruitment/postings/${openPostingId}/status`, hrToken).send({
      status: "OPEN",
    });

    const draftPosting = await authed("post", "/api/v1/recruitment/postings", hrToken).send({
      title: "Unpublished Role",
      departmentId,
      positionId,
      employmentType: "FULL_TIME",
    });
    draftPostingId = draftPosting.body.data.id;
  });

  afterAll(async () => {
    await prisma.auditLog.deleteMany({ where: { organizationId } });
    await prisma.offer.deleteMany({ where: { application: { jobPosting: { organizationId } } } });
    await prisma.interview.deleteMany({ where: { application: { jobPosting: { organizationId } } } });
    await prisma.candidateApplication.deleteMany({ where: { jobPosting: { organizationId } } });
    await prisma.candidatePortalAccount.deleteMany({ where: { candidate: { organizationId } } });
    await prisma.candidate.deleteMany({ where: { organizationId } });
    await prisma.jobPosting.deleteMany({ where: { organizationId } });
    await prisma.employee.deleteMany({ where: { organizationId } });
    await prisma.user.deleteMany({ where: { organizationId } });
    await prisma.position.deleteMany({ where: { organizationId } });
    await prisma.department.deleteMany({ where: { organizationId } });
    await prisma.organization.delete({ where: { id: organizationId } });
    await prisma.$disconnect();
  });

  it("lists only OPEN postings on the public careers page, and 404s for an unknown/disabled slug", async () => {
    const list = await publicReq("get", `/api/v1/careers/${orgSlug}/jobs`);
    expect(list.status).toBe(200);
    const ids = list.body.data.map((p: { id: string }) => p.id);
    expect(ids).toContain(openPostingId);
    expect(ids).not.toContain(draftPostingId);

    const detail = await publicReq("get", `/api/v1/careers/${orgSlug}/jobs/${openPostingId}`);
    expect(detail.status).toBe(200);
    expect(detail.body.data.title).toBe("Backend Engineer");

    const draftDetail = await publicReq("get", `/api/v1/careers/${orgSlug}/jobs/${draftPostingId}`);
    expect(draftDetail.status).toBe(404);

    const unknownSlug = await publicReq("get", `/api/v1/careers/${randomUUID()}/jobs`);
    expect(unknownSlug.status).toBe(404);
  });

  it("registers a candidate, rejects a duplicate registration, and logs in", async () => {
    const email = `candidate.${randomUUID()}@example.com`;
    const password = "CandidatePassword123!";

    const register = await publicReq("post", `/api/v1/careers/${orgSlug}/register`).send({
      email,
      password,
      fullName: "Jane Applicant",
      phone: "+959111222333",
    });
    expect(register.status).toBe(201);
    expect(typeof register.body.data.token).toBe("string");
    const candidateToken = register.body.data.token as string;

    const duplicate = await publicReq("post", `/api/v1/careers/${orgSlug}/register`).send({
      email,
      password,
      fullName: "Jane Applicant",
    });
    expect(duplicate.status).toBe(409);
    expect(duplicate.body.error.code).toBe("ACCOUNT_ALREADY_EXISTS");

    const wrongPassword = await publicReq("post", `/api/v1/careers/${orgSlug}/login`).send({
      email,
      password: "WrongPassword!",
    });
    expect(wrongPassword.status).toBe(401);

    const login = await publicReq("post", `/api/v1/careers/${orgSlug}/login`).send({ email, password });
    expect(login.status).toBe(200);
    expect(typeof login.body.data.token).toBe("string");

    // Candidate identity is fully separate from internal auth (Sprint 3
    // HLD §3): a candidate token must never satisfy requireAuth.
    const crossAuthAttempt = await request(app)
      .get("/api/v1/auth/me")
      .set("Authorization", `Bearer ${candidateToken}`);
    expect(crossAuthAttempt.status).toBe(401);

    // ...and vice versa: an internal token must never satisfy requireCandidateAuth.
    const reverseCrossAuthAttempt = await request(app)
      .get("/api/v1/candidate-portal/me")
      .set("Authorization", `Bearer ${hrToken}`);
    expect(reverseCrossAuthAttempt.status).toBe(401);
  });

  it("reuses an existing HR-entered Candidate row on registration instead of duplicating it (CAREER-03)", async () => {
    const email = `hr-entered.${randomUUID()}@example.com`;

    const hrEntered = await authed(
      "post",
      `/api/v1/recruitment/postings/${openPostingId}/candidates`,
      hrToken,
    )
      .field("fullName", "HR Entered Candidate")
      .field("email", email);
    expect(hrEntered.status).toBe(201);

    const register = await publicReq("post", `/api/v1/careers/${orgSlug}/register`).send({
      email,
      password: "CandidatePassword123!",
      fullName: "HR Entered Candidate",
    });
    expect(register.status).toBe(201);

    const candidateRows = await prisma.candidate.findMany({ where: { organizationId, email } });
    expect(candidateRows).toHaveLength(1);
  });

  it("applies to a job, rejects a duplicate open application, and only shows the candidate's own applications", async () => {
    const email = `applicant.${randomUUID()}@example.com`;
    const password = "CandidatePassword123!";
    const register = await publicReq("post", `/api/v1/careers/${orgSlug}/register`).send({
      email,
      password,
      fullName: "Apply Test",
    });
    const candidateToken = register.body.data.token as string;

    const apply = await request(app)
      .post(`/api/v1/candidate-portal/jobs/${openPostingId}/apply`)
      .set("Authorization", `Bearer ${candidateToken}`);
    expect(apply.status).toBe(201);
    expect(apply.body.data.stage).toBe("APPLIED");
    // Internal-only fields must never reach the candidate view.
    expect(apply.body.data.hiringManagerUserId).toBeUndefined();

    const duplicateApply = await request(app)
      .post(`/api/v1/candidate-portal/jobs/${openPostingId}/apply`)
      .set("Authorization", `Bearer ${candidateToken}`);
    expect(duplicateApply.status).toBe(409);
    expect(duplicateApply.body.error.code).toBe("DUPLICATE_APPLICATION");

    const closedApply = await request(app)
      .post(`/api/v1/candidate-portal/jobs/${draftPostingId}/apply`)
      .set("Authorization", `Bearer ${candidateToken}`);
    expect(closedApply.status).toBe(404);

    const list = await request(app)
      .get("/api/v1/candidate-portal/applications")
      .set("Authorization", `Bearer ${candidateToken}`);
    expect(list.status).toBe(200);
    expect(list.body.data).toHaveLength(1);
    expect(list.body.data[0].jobPosting.id).toBe(openPostingId);

    // A second candidate must never see the first candidate's application.
    const otherRegister = await publicReq("post", `/api/v1/careers/${orgSlug}/register`).send({
      email: `other.${randomUUID()}@example.com`,
      password,
      fullName: "Other Candidate",
    });
    const otherToken = otherRegister.body.data.token as string;
    const otherViewsFirstApplication = await request(app)
      .get(`/api/v1/candidate-portal/applications/${apply.body.data.id}`)
      .set("Authorization", `Bearer ${otherToken}`);
    expect(otherViewsFirstApplication.status).toBe(404);
  });

  it("hides interviewer identity and feedback from the candidate view, but shows the candidate's own offer", async () => {
    const email = `interview-view.${randomUUID()}@example.com`;
    const password = "CandidatePassword123!";
    const register = await publicReq("post", `/api/v1/careers/${orgSlug}/register`).send({
      email,
      password,
      fullName: "Interview View Test",
    });
    const candidateToken = register.body.data.token as string;

    const apply = await request(app)
      .post(`/api/v1/candidate-portal/jobs/${openPostingId}/apply`)
      .set("Authorization", `Bearer ${candidateToken}`);
    const applicationId = apply.body.data.id as string;

    await authed("patch", `/api/v1/recruitment/applications/${applicationId}/stage`, hrToken).send({
      stage: "SCREENING",
    });
    await authed("patch", `/api/v1/recruitment/applications/${applicationId}/stage`, hrToken).send({
      stage: "INTERVIEW",
    });
    await authed("post", `/api/v1/recruitment/applications/${applicationId}/interviews`, hrToken).send({
      scheduledAt: "2026-11-20T09:00:00.000Z",
      mode: "REMOTE",
      interviewerNames: "Alice Interviewer, Bob Interviewer",
    });
    await authed("post", `/api/v1/recruitment/applications/${applicationId}/offer`, hrToken).send({
      proposedSalary: 1_800_000,
      currency: "MMK",
      startDate: "2026-12-01",
    });

    const detail = await request(app)
      .get(`/api/v1/candidate-portal/applications/${applicationId}`)
      .set("Authorization", `Bearer ${candidateToken}`);
    expect(detail.status).toBe(200);
    expect(detail.body.data.interviews).toHaveLength(1);
    expect(detail.body.data.interviews[0].mode).toBe("REMOTE");
    expect(detail.body.data.interviews[0].interviewerNames).toBeUndefined();
    expect(detail.body.data.interviews[0].feedback).toBeUndefined();
    expect(detail.body.data.interviews[0].score).toBeUndefined();
    expect(detail.body.data.offers).toHaveLength(1);
    expect(Number(detail.body.data.offers[0].proposedSalary)).toBe(1_800_000);
  });
});
