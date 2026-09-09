import { randomUUID } from "node:crypto";
import bcrypt from "bcrypt";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@database/prisma";
import { createApp } from "../../app";

const app = createApp();
const PERIOD = "2026-11";

describe("expenses module", () => {
  let organizationId: string;
  let departmentId: string;
  let positionId: string;
  let hrToken: string;
  let categoryId: string;
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

    const hrPasswordHash = await bcrypt.hash("HrPassword123!", 10);
    await prisma.user.create({
      data: { organizationId, email: "hr@test.local", passwordHash: hrPasswordHash, role: "HR_ADMIN" },
    });
    const hrLogin = await request(app)
      .post("/api/v1/auth/login")
      .send({ email: "hr@test.local", password: "HrPassword123!" });
    hrToken = hrLogin.body.data.token;

    const category = await authed("post", "/api/v1/expenses/categories", hrToken).send({
      name: "Travel",
      requiresReceipt: true,
    });
    categoryId = category.body.data.id;

    const email = `worker.expenses.${randomUUID()}@test.local`;
    const password = "EmpPassword123!";
    const create = await request(app)
      .post("/api/v1/employees")
      .set("Authorization", `Bearer ${hrToken}`)
      .send({ email, password, joinDate: "2026-01-01", departmentId, positionId, workModel: "OFFICE" });
    employeeId = create.body.data.id;
    await authed("post", `/api/v1/employees/${employeeId}/activate`, hrToken);
    await authed("patch", `/api/v1/employees/${employeeId}/salary-profile`, hrToken).send({
      basicSalary: 1_000_000,
    });
    const login = await request(app).post("/api/v1/auth/login").send({ email, password });
    employeeToken = login.body.data.token;
  });

  afterAll(async () => {
    await prisma.auditLog.deleteMany({ where: { organizationId } });
    await prisma.notification.deleteMany({ where: { organizationId } });
    await prisma.notificationEvent.deleteMany({ where: { organizationId } });
    await prisma.payslip.deleteMany({ where: { payrollItem: { employee: { organizationId } } } });
    await prisma.expenseReceipt.deleteMany({ where: { expenseClaim: { organizationId } } });
    await prisma.expenseClaim.deleteMany({ where: { organizationId } });
    await prisma.payrollItem.deleteMany({ where: { employee: { organizationId } } });
    await prisma.payrollRun.deleteMany({ where: { organizationId } });
    await prisma.expenseCategory.deleteMany({ where: { organizationId } });
    await prisma.salaryProfile.deleteMany({ where: { employee: { organizationId } } });
    await prisma.employee.deleteMany({ where: { organizationId } });
    await prisma.user.deleteMany({ where: { organizationId } });
    await prisma.position.deleteMany({ where: { organizationId } });
    await prisma.department.deleteMany({ where: { organizationId } });
    await prisma.organization.delete({ where: { id: organizationId } });
    await prisma.$disconnect();
  });

  it("blocks submission of a receipt-required claim with no receipt (EXP-03)", async () => {
    const claim = await authed("post", "/api/v1/expenses/claims", employeeToken).send({
      categoryId,
      amount: 25_000,
      expenseDate: `${PERIOD}-05`,
      description: "Taxi to client site",
    });
    expect(claim.status).toBe(201);

    const submit = await authed("post", `/api/v1/expenses/claims/${claim.body.data.id}/submit`, employeeToken);
    expect(submit.status).toBe(422);
    expect(submit.body.error.code).toBe("RECEIPT_REQUIRED");
  });

  it("full lifecycle: submit with receipt -> approve -> reimbursed via payroll (EXP-05/06/07)", async () => {
    const claim = await authed("post", "/api/v1/expenses/claims", employeeToken).send({
      categoryId,
      amount: 40_000,
      expenseDate: `${PERIOD}-10`,
      description: "Client dinner",
    });
    const claimId = claim.body.data.id;

    const upload = await request(app)
      .post(`/api/v1/expenses/claims/${claimId}/receipts`)
      .set("Authorization", `Bearer ${employeeToken}`)
      .attach("files", Buffer.from("%PDF-1.4 fake receipt"), "receipt.pdf");
    expect(upload.status).toBe(201);

    const submit = await authed("post", `/api/v1/expenses/claims/${claimId}/submit`, employeeToken);
    expect(submit.status).toBe(200);
    expect(submit.body.data.status).toBe("SUBMITTED");

    // Only HR/Super Admin may decide a claim.
    const employeeApprove = await authed("post", `/api/v1/expenses/claims/${claimId}/approve`, employeeToken);
    expect(employeeApprove.status).toBe(403);

    const approve = await authed("post", `/api/v1/expenses/claims/${claimId}/approve`, hrToken);
    expect(approve.status).toBe(200);
    expect(approve.body.data.status).toBe("APPROVED");

    const doubleApprove = await authed("post", `/api/v1/expenses/claims/${claimId}/approve`, hrToken);
    expect(doubleApprove.status).toBe(409);
    expect(doubleApprove.body.error.code).toBe("EXPENSE_ALREADY_DECIDED");

    const run = await authed("post", "/api/v1/payroll/runs", hrToken).send({ period: PERIOD });
    const calculate = await authed(
      "post",
      `/api/v1/payroll/runs/${run.body.data.id}/calculate`,
      hrToken,
    );
    expect(calculate.status).toBe(200);

    const item = calculate.body.data.items.find(
      (i: { employeeId: string }) => i.employeeId === employeeId,
    );
    expect(Number(item.gross)).toBeCloseTo(1_000_000 + 40_000, 5);

    const reimbursedClaim = await prisma.expenseClaim.findUniqueOrThrow({ where: { id: claimId } });
    expect(reimbursedClaim.status).toBe("REIMBURSED");
    expect(reimbursedClaim.payrollItemId).not.toBeNull();
  });

  describe("standalone reimbursement (EXP-09..11)", () => {
    async function createApprovedClaim(expenseDate: string) {
      const claim = await authed("post", "/api/v1/expenses/claims", employeeToken).send({
        categoryId,
        amount: 15_000,
        expenseDate,
        description: "Office supplies",
      });
      const claimId = claim.body.data.id;

      await request(app)
        .post(`/api/v1/expenses/claims/${claimId}/receipts`)
        .set("Authorization", `Bearer ${employeeToken}`)
        .attach("files", Buffer.from("%PDF-1.4 fake receipt"), "receipt.pdf");
      await authed("post", `/api/v1/expenses/claims/${claimId}/submit`, employeeToken);
      await authed("post", `/api/v1/expenses/claims/${claimId}/approve`, hrToken);

      return claimId;
    }

    it("reimburses an approved claim standalone, with no payroll run in the period", async () => {
      const claimId = await createApprovedClaim(`${PERIOD}-12`);

      const employeeAttempt = await authed(
        "post",
        `/api/v1/expenses/claims/${claimId}/reimburse`,
        employeeToken,
      ).send({ disbursementMethod: "BANK_TRANSFER", disbursementReference: "TXN-001" });
      expect(employeeAttempt.status).toBe(403);

      const reimburse = await authed(
        "post",
        `/api/v1/expenses/claims/${claimId}/reimburse`,
        hrToken,
      ).send({ disbursementMethod: "BANK_TRANSFER", disbursementReference: "TXN-001" });
      expect(reimburse.status).toBe(200);
      expect(reimburse.body.data.status).toBe("REIMBURSED");

      const claim = await prisma.expenseClaim.findUniqueOrThrow({ where: { id: claimId } });
      expect(claim.payrollItemId).toBeNull();
      expect(claim.disbursementMethod).toBe("BANK_TRANSFER");
      expect(claim.disbursementReference).toBe("TXN-001");
      expect(claim.disbursedAt).not.toBeNull();
    });

    it("rejects reimbursing a claim that isn't APPROVED", async () => {
      const claim = await authed("post", "/api/v1/expenses/claims", employeeToken).send({
        categoryId,
        amount: 5_000,
        expenseDate: `${PERIOD}-13`,
        description: "Draft claim",
      });

      const reimburse = await authed(
        "post",
        `/api/v1/expenses/claims/${claim.body.data.id}/reimburse`,
        hrToken,
      ).send({ disbursementMethod: "CASH", disbursementReference: "N/A" });
      expect(reimburse.status).toBe(409);
      expect(reimburse.body.error.code).toBe("INVALID_STATUS_TRANSITION");
    });

    it("rejects reimbursing a claim already attached to a payroll run", async () => {
      // A distinct period from PERIOD — the "full lifecycle" test above
      // already created and calculated a run for PERIOD, and a payroll run
      // is unique per period per org.
      const otherPeriod = "2026-12";
      const claimId = await createApprovedClaim(`${otherPeriod}-14`);

      const run = await authed("post", "/api/v1/payroll/runs", hrToken).send({ period: otherPeriod });
      await authed("post", `/api/v1/payroll/runs/${run.body.data.id}/calculate`, hrToken);

      const claim = await prisma.expenseClaim.findUniqueOrThrow({ where: { id: claimId } });
      expect(claim.status).toBe("REIMBURSED");
      expect(claim.payrollItemId).not.toBeNull();

      const reimburse = await authed(
        "post",
        `/api/v1/expenses/claims/${claimId}/reimburse`,
        hrToken,
      ).send({ disbursementMethod: "CASH", disbursementReference: "N/A" });
      expect(reimburse.status).toBe(409);
      expect(reimburse.body.error.code).toBe("INVALID_STATUS_TRANSITION");
    });

    it("generates a bank disbursement CSV listing APPROVED unreimbursed claims (BANK-01)", async () => {
      await authed("patch", `/api/v1/employees/${employeeId}`, hrToken).send({
        bankName: "Expense Test Bank",
        bankAccountName: "Expense Test Worker",
        bankAccountNumber: "987654321",
      });

      const claimId = await createApprovedClaim(`${PERIOD}-15`);

      const forbidden = await authed("get", "/api/v1/expenses/disbursement-file", employeeToken);
      expect(forbidden.status).toBe(403);

      const csvRes = await authed("get", "/api/v1/expenses/disbursement-file", hrToken);
      expect(csvRes.status).toBe(200);
      expect(csvRes.headers["content-type"]).toContain("text/csv");
      expect(csvRes.text).toContain("Expense Test Bank");
      expect(csvRes.text).toContain("987654321");
      expect(csvRes.text).toContain(claimId);
    });
  });
});
