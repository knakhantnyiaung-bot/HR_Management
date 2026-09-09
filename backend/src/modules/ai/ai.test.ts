import { randomUUID } from "node:crypto";
import bcrypt from "bcrypt";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@database/prisma";
import { createApp } from "../../app";

const app = createApp();

// No ANTHROPIC_API_KEY is set in .env.test (same "optional, degrades
// gracefully" treatment as Google Calendar/VAPID — see calendar.test.ts).
// That means every test here exercises code paths reachable without ever
// calling the real Claude API: auth, config-missing, and validation.
describe("AI HR assistant (AI-01..05)", () => {
  let organizationId: string;
  let employeeToken: string;

  beforeAll(async () => {
    const org = await prisma.organization.create({ data: { name: `Test Org ${randomUUID()}` } });
    organizationId = org.id;

    const dept = await prisma.department.create({ data: { organizationId, name: "Engineering" } });
    const position = await prisma.position.create({
      data: { organizationId, title: "Engineer", departmentId: dept.id },
    });

    const passwordHash = await bcrypt.hash("EmployeePassword123!", 10);
    const user = await prisma.user.create({
      data: { organizationId, email: "employee@test.local", passwordHash, role: "EMPLOYEE" },
    });
    await prisma.employee.create({
      data: {
        organizationId,
        userId: user.id,
        employeeNo: "EMP-AI-1",
        joinDate: new Date("2024-01-01"),
        departmentId: dept.id,
        positionId: position.id,
        workModel: "OFFICE",
        status: "ACTIVE",
      },
    });

    const login = await request(app)
      .post("/api/v1/auth/login")
      .send({ email: "employee@test.local", password: "EmployeePassword123!" });
    employeeToken = login.body.data.token;
  });

  afterAll(async () => {
    await prisma.organization.delete({ where: { id: organizationId } }).catch(() => undefined);
  });

  it("rejects an unauthenticated request", async () => {
    const res = await request(app).post("/api/v1/ai/chat").send({ message: "What is my leave balance?" });
    expect(res.status).toBe(401);
  });

  it("returns AI_ASSISTANT_NOT_CONFIGURED when no API key is set", async () => {
    const res = await request(app)
      .post("/api/v1/ai/chat")
      .set("Authorization", `Bearer ${employeeToken}`)
      .send({ message: "What is my leave balance?" });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("AI_ASSISTANT_NOT_CONFIGURED");
  });

  it("validates the request body before reaching the assistant", async () => {
    const res = await request(app)
      .post("/api/v1/ai/chat")
      .set("Authorization", `Bearer ${employeeToken}`)
      .send({ message: "" });
    expect(res.status).toBe(400);
  });
});
