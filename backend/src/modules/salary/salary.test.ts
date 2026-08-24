import { randomUUID } from "node:crypto";
import bcrypt from "bcrypt";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@database/prisma";
import { createApp } from "../../app";

const app = createApp();

function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function daysFromNow(days: number): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + days);
  return isoDate(d);
}

describe("salary module", () => {
  let organizationId: string;
  let departmentId: string;
  let positionId: string;
  let hrToken: string;

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
  });

  afterAll(async () => {
    await prisma.auditLog.deleteMany({ where: { organizationId } });
    await prisma.salaryProfile.deleteMany({ where: { employee: { organizationId } } });
    await prisma.employee.deleteMany({ where: { organizationId } });
    await prisma.user.deleteMany({ where: { organizationId } });
    await prisma.position.deleteMany({ where: { organizationId } });
    await prisma.department.deleteMany({ where: { organizationId } });
    await prisma.organization.delete({ where: { id: organizationId } });
    await prisma.$disconnect();
  });

  it("creates an initial profile effective today by default, then supersedes it without mutating the old row", async () => {
    const { employeeId } = await createActiveEmployee("worker.raise", "EmpPassword123!");

    const initial = await authed("patch", `/api/v1/employees/${employeeId}/salary-profile`, hrToken)
      .send({ basicSalary: 1000000, allowances: { transport: 50000 } });
    expect(initial.status).toBe(201);
    expect(initial.body.data.effectiveFrom.slice(0, 10)).toBe(isoDate(new Date()));
    expect(initial.body.data.effectiveTo).toBeNull();
    const initialId = initial.body.data.id;

    const current = await authed("get", `/api/v1/employees/${employeeId}/salary-profile`, hrToken);
    expect(current.status).toBe(200);
    expect(current.body.data.id).toBe(initialId);
    expect(Number(current.body.data.basicSalary)).toBe(1000000);

    const raiseDate = daysFromNow(30);
    const raise = await authed("patch", `/api/v1/employees/${employeeId}/salary-profile`, hrToken)
      .send({ basicSalary: 1200000, effectiveFrom: raiseDate });
    expect(raise.status).toBe(201);
    expect(raise.body.data.id).not.toBe(initialId);

    // A future-dated raise must not show as "current" yet.
    const stillOld = await authed("get", `/api/v1/employees/${employeeId}/salary-profile`, hrToken);
    expect(stillOld.body.data.id).toBe(initialId);

    const history = await authed(
      "get",
      `/api/v1/employees/${employeeId}/salary-profile/history`,
      hrToken,
    );
    expect(history.status).toBe(200);
    expect(history.body.data).toHaveLength(2);
    const oldRow = history.body.data.find((p: { id: string }) => p.id === initialId);
    expect(oldRow.effectiveTo).not.toBeNull();
    // The old row's basicSalary must be untouched — it's what historical
    // payroll snapshots would have already referenced (HLD ADR-005).
    expect(Number(oldRow.basicSalary)).toBe(1000000);
  });

  it("rejects a new effective date that doesn't come after the current profile's", async () => {
    const { employeeId } = await createActiveEmployee("worker.baddate", "EmpPassword123!");
    await authed("patch", `/api/v1/employees/${employeeId}/salary-profile`, hrToken).send({
      basicSalary: 900000,
      effectiveFrom: daysFromNow(10),
    });

    const tooEarly = await authed(
      "patch",
      `/api/v1/employees/${employeeId}/salary-profile`,
      hrToken,
    ).send({ basicSalary: 950000, effectiveFrom: daysFromNow(10) });
    expect(tooEarly.status).toBe(409);
    expect(tooEarly.body.error.code).toBe("SALARY_EFFECTIVE_DATE_TOO_EARLY");
  });

  it("lets an employee view only their own salary profile, and never write to it", async () => {
    const a = await createActiveEmployee("worker.own.a", "EmpPassword123!");
    const b = await createActiveEmployee("worker.own.b", "EmpPassword123!");
    await authed("patch", `/api/v1/employees/${a.employeeId}/salary-profile`, hrToken).send({
      basicSalary: 800000,
    });

    const ownView = await authed(
      "get",
      `/api/v1/employees/${a.employeeId}/salary-profile`,
      a.token,
    );
    expect(ownView.status).toBe(200);

    const othersView = await authed(
      "get",
      `/api/v1/employees/${a.employeeId}/salary-profile`,
      b.token,
    );
    expect(othersView.status).toBe(403);

    const writeAttempt = await authed(
      "patch",
      `/api/v1/employees/${a.employeeId}/salary-profile`,
      a.token,
    ).send({ basicSalary: 5000000 });
    expect(writeAttempt.status).toBe(403);

    const historyAttempt = await authed(
      "get",
      `/api/v1/employees/${a.employeeId}/salary-profile/history`,
      a.token,
    );
    expect(historyAttempt.status).toBe(403);
  });

  it("returns 404 when an employee has no salary profile yet", async () => {
    const { employeeId } = await createActiveEmployee("worker.none", "EmpPassword123!");
    const res = await authed("get", `/api/v1/employees/${employeeId}/salary-profile`, hrToken);
    expect(res.status).toBe(404);
  });

  it("serializes concurrent salary changes so only one of two identical effective dates wins", async () => {
    const { employeeId } = await createActiveEmployee("worker.race", "EmpPassword123!");
    await authed("patch", `/api/v1/employees/${employeeId}/salary-profile`, hrToken).send({
      basicSalary: 1000000,
    });

    const raiseDate = daysFromNow(60);
    const [first, second] = await Promise.all([
      authed("patch", `/api/v1/employees/${employeeId}/salary-profile`, hrToken).send({
        basicSalary: 1100000,
        effectiveFrom: raiseDate,
      }),
      authed("patch", `/api/v1/employees/${employeeId}/salary-profile`, hrToken).send({
        basicSalary: 1150000,
        effectiveFrom: raiseDate,
      }),
    ]);
    const statuses = [first.status, second.status].sort();
    expect(statuses).toEqual([201, 409]);

    const history = await authed(
      "get",
      `/api/v1/employees/${employeeId}/salary-profile/history`,
      hrToken,
    );
    expect(history.body.data).toHaveLength(2);
    const openRows = history.body.data.filter(
      (p: { effectiveTo: string | null }) => p.effectiveTo === null,
    );
    expect(openRows).toHaveLength(1);
  });
});
