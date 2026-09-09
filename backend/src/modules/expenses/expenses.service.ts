import { ExpenseClaimStatus, Prisma } from "@prisma/client";
import { prisma } from "@database/prisma";
import type { AuthContext } from "@common/auth/requireAuth";
import { AppError } from "@common/errors/AppError";
import { buildCsv } from "@common/csv/buildCsv";
import { extensionForMimeType } from "@common/upload/multerConfig";
import { storageAdapter } from "@common/storage/storageAdapter";
import { recordAudit } from "@modules/audit/audit.service";
import { getEmployeeByUserId } from "@modules/employees/employees.service";
import { emitNotificationEvent } from "@modules/notifications/notification.emitter";
import type {
  CreateExpenseCategoryInput,
  CreateExpenseClaimInput,
  ListExpenseClaimsQuery,
  ReimburseExpenseClaimInput,
  UpdateExpenseClaimInput,
} from "@modules/expenses/expenses.schema";

const EXPENSE_CLAIM_INCLUDE = {
  employee: {
    select: { id: true, employeeNo: true, userId: true, user: { select: { email: true } } },
  },
  category: { select: { id: true, name: true, requiresReceipt: true } },
  receipts: { select: { id: true, fileName: true, mimeType: true, sizeBytes: true, createdAt: true } },
} satisfies Prisma.ExpenseClaimInclude;

const MAX_RECEIPTS_PER_CLAIM = 5;

// ---------------------------------------------------------------------------
// Categories
// ---------------------------------------------------------------------------

export async function listExpenseCategories(organizationId: string) {
  return prisma.expenseCategory.findMany({ where: { organizationId }, orderBy: { name: "asc" } });
}

export async function createExpenseCategory(
  organizationId: string,
  input: CreateExpenseCategoryInput,
  actorId: string,
) {
  try {
    return await prisma.$transaction(async (tx) => {
      const category = await tx.expenseCategory.create({
        data: { organizationId, name: input.name, requiresReceipt: input.requiresReceipt },
      });

      await recordAudit(
        {
          organizationId,
          actorId,
          action: "EXPENSE_CATEGORY_CREATED",
          resourceType: "ExpenseCategory",
          resourceId: category.id,
          metadata: input,
        },
        tx,
      );

      return category;
    });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      throw AppError.conflict(
        "CATEGORY_ALREADY_EXISTS",
        `An expense category named "${input.name}" already exists`,
      );
    }
    throw err;
  }
}

// ---------------------------------------------------------------------------
// Claims — EXP-01..EXP-08
// ---------------------------------------------------------------------------

async function assertActiveCategory(organizationId: string, categoryId: string) {
  const category = await prisma.expenseCategory.findFirst({
    where: { id: categoryId, organizationId, status: "ACTIVE" },
  });
  if (!category) {
    throw AppError.badRequest("INVALID_CATEGORY", "Expense category not found in this organization");
  }
  return category;
}

export async function createExpenseClaim(
  organizationId: string,
  userId: string,
  input: CreateExpenseClaimInput,
) {
  const employee = await getEmployeeByUserId(organizationId, userId);
  await assertActiveCategory(organizationId, input.categoryId);

  return prisma.expenseClaim.create({
    data: {
      organizationId,
      employeeId: employee.id,
      categoryId: input.categoryId,
      amount: input.amount,
      expenseDate: input.expenseDate,
      description: input.description,
      status: ExpenseClaimStatus.DRAFT,
    },
    include: EXPENSE_CLAIM_INCLUDE,
  });
}

export async function listExpenseClaims(
  organizationId: string,
  requester: { userId: string; role: AuthContext["role"] },
  query: ListExpenseClaimsQuery,
) {
  const where: Prisma.ExpenseClaimWhereInput = { organizationId };

  if (requester.role !== "HR_ADMIN" && requester.role !== "SUPER_ADMIN") {
    const employee = await getEmployeeByUserId(organizationId, requester.userId);
    where.employeeId = employee.id;
  } else if (query.employeeId) {
    where.employeeId = query.employeeId;
  }

  if (query.status) {
    where.status = query.status;
  }

  const [items, total] = await Promise.all([
    prisma.expenseClaim.findMany({
      where,
      include: EXPENSE_CLAIM_INCLUDE,
      orderBy: { createdAt: "desc" },
      skip: (query.page - 1) * query.pageSize,
      take: query.pageSize,
    }),
    prisma.expenseClaim.count({ where }),
  ]);

  return { items, meta: { page: query.page, pageSize: query.pageSize, total } };
}

async function getOwnedDraftClaim(organizationId: string, claimId: string, userId: string) {
  const employee = await getEmployeeByUserId(organizationId, userId);
  const claim = await prisma.expenseClaim.findFirst({ where: { id: claimId, organizationId } });
  if (!claim) {
    throw AppError.notFound("ExpenseClaim");
  }
  if (claim.employeeId !== employee.id) {
    throw AppError.forbidden("You may only modify your own expense claim");
  }
  if (claim.status !== ExpenseClaimStatus.DRAFT) {
    throw AppError.conflict(
      "INVALID_STATUS_TRANSITION",
      `Cannot modify an expense claim in status ${claim.status}`,
    );
  }
  return claim;
}

// EXP-01 — only DRAFT, only the owner.
export async function updateExpenseClaim(
  organizationId: string,
  claimId: string,
  userId: string,
  input: UpdateExpenseClaimInput,
) {
  await getOwnedDraftClaim(organizationId, claimId, userId);
  if (input.categoryId) {
    await assertActiveCategory(organizationId, input.categoryId);
  }

  return prisma.expenseClaim.update({
    where: { id: claimId },
    data: input,
    include: EXPENSE_CLAIM_INCLUDE,
  });
}

interface LockedExpenseClaimRow {
  id: string;
  employeeId: string;
  categoryId: string;
  status: ExpenseClaimStatus;
}

// Same FOR UPDATE pattern as overtime/payroll — prevents two concurrent
// decisions (or a decision racing a submit/cancel) from both observing a
// stale status.
async function lockExpenseClaim(
  tx: Prisma.TransactionClient,
  organizationId: string,
  claimId: string,
): Promise<LockedExpenseClaimRow> {
  const rows = await tx.$queryRaw<LockedExpenseClaimRow[]>`
    SELECT id, employee_id AS "employeeId", category_id AS "categoryId", status
    FROM expense_claims
    WHERE id = ${claimId} AND organization_id = ${organizationId}
    FOR UPDATE
  `;
  const row = rows[0];
  if (!row) {
    throw AppError.notFound("ExpenseClaim");
  }
  return row;
}

async function reloadExpenseClaim(tx: Prisma.TransactionClient, claimId: string) {
  return tx.expenseClaim.findUniqueOrThrow({ where: { id: claimId }, include: EXPENSE_CLAIM_INCLUDE });
}

// EXP-02/EXP-03 — submitting locks the claim from further edits; a
// receipt-required category without at least one receipt rejects here.
export async function submitExpenseClaim(organizationId: string, claimId: string, userId: string) {
  const employee = await getEmployeeByUserId(organizationId, userId);

  return prisma.$transaction(async (tx) => {
    const locked = await lockExpenseClaim(tx, organizationId, claimId);

    if (locked.employeeId !== employee.id) {
      throw AppError.forbidden("You may only submit your own expense claim");
    }
    if (locked.status !== ExpenseClaimStatus.DRAFT) {
      throw AppError.conflict(
        "INVALID_STATUS_TRANSITION",
        `Cannot submit an expense claim in status ${locked.status}`,
      );
    }

    const category = await tx.expenseCategory.findUniqueOrThrow({ where: { id: locked.categoryId } });
    if (category.requiresReceipt) {
      const receiptCount = await tx.expenseReceipt.count({ where: { expenseClaimId: claimId } });
      if (receiptCount === 0) {
        throw AppError.businessRule(
          "RECEIPT_REQUIRED",
          "This expense category requires at least one receipt before submission",
        );
      }
    }

    await tx.expenseClaim.update({
      where: { id: claimId },
      data: { status: ExpenseClaimStatus.SUBMITTED },
    });

    await recordAudit(
      {
        organizationId,
        actorId: userId,
        action: "EXPENSE_CLAIM_SUBMITTED",
        resourceType: "ExpenseClaim",
        resourceId: claimId,
        metadata: {},
      },
      tx,
    );

    return reloadExpenseClaim(tx, claimId);
  });
}

// EXP-08 — owner may cancel a DRAFT or SUBMITTED (pre-decision) claim.
export async function cancelExpenseClaim(organizationId: string, claimId: string, userId: string) {
  const employee = await getEmployeeByUserId(organizationId, userId);

  return prisma.$transaction(async (tx) => {
    const locked = await lockExpenseClaim(tx, organizationId, claimId);

    if (locked.employeeId !== employee.id) {
      throw AppError.forbidden("You may only cancel your own expense claim");
    }
    if (
      locked.status !== ExpenseClaimStatus.DRAFT &&
      locked.status !== ExpenseClaimStatus.SUBMITTED
    ) {
      throw AppError.conflict(
        "INVALID_STATUS_TRANSITION",
        `Cannot cancel an expense claim in status ${locked.status}`,
      );
    }

    await tx.expenseClaim.update({
      where: { id: claimId },
      data: { status: ExpenseClaimStatus.CANCELLED },
    });

    await recordAudit(
      {
        organizationId,
        actorId: userId,
        action: "EXPENSE_CLAIM_CANCELLED",
        resourceType: "ExpenseClaim",
        resourceId: claimId,
        metadata: {},
      },
      tx,
    );

    return reloadExpenseClaim(tx, claimId);
  });
}

// EXP-04 — HR Admin/Super Admin only (enforced at the route level).
async function decideExpenseClaim(
  organizationId: string,
  claimId: string,
  actorId: string,
  target: typeof ExpenseClaimStatus.APPROVED | typeof ExpenseClaimStatus.REJECTED,
  rejectionReason?: string,
) {
  const decided = await prisma.$transaction(async (tx) => {
    const locked = await lockExpenseClaim(tx, organizationId, claimId);

    if (locked.status !== ExpenseClaimStatus.SUBMITTED) {
      throw AppError.conflict(
        "EXPENSE_ALREADY_DECIDED",
        `Cannot decide an expense claim in status ${locked.status}`,
      );
    }

    await tx.expenseClaim.update({
      where: { id: claimId },
      data: {
        status: target,
        approvedBy: actorId,
        approvedAt: new Date(),
        ...(rejectionReason ? { rejectionReason } : {}),
      },
    });

    await recordAudit(
      {
        organizationId,
        actorId,
        action: target === ExpenseClaimStatus.APPROVED ? "EXPENSE_CLAIM_APPROVED" : "EXPENSE_CLAIM_REJECTED",
        resourceType: "ExpenseClaim",
        resourceId: claimId,
        metadata: rejectionReason ? { reason: rejectionReason } : {},
      },
      tx,
    );

    const claim = await reloadExpenseClaim(tx, claimId);

    // NOTIF wiring (Sec 7.2) — additive: one outbox insert in the same
    // transaction as the decision, no change to the decision logic itself.
    await emitNotificationEvent(tx, {
      organizationId,
      eventType: "expense.claim.decided",
      recipientUserIds: [claim.employee.userId],
      data: { status: target, categoryName: claim.category.name },
      relatedResourceType: "ExpenseClaim",
      relatedResourceId: claimId,
    });

    return claim;
  });

  return decided;
}

export const approveExpenseClaim = (organizationId: string, claimId: string, actorId: string) =>
  decideExpenseClaim(organizationId, claimId, actorId, ExpenseClaimStatus.APPROVED);

export const rejectExpenseClaim = (
  organizationId: string,
  claimId: string,
  actorId: string,
  reason: string,
) => decideExpenseClaim(organizationId, claimId, actorId, ExpenseClaimStatus.REJECTED, reason);

// EXP-09..11 — HR Admin/Super Admin only (enforced at the route level).
// Reimburses an APPROVED claim directly, independent of any payroll run —
// the whole point being that reimbursement no longer has to wait for the
// next payroll cycle. Mutually exclusive with the existing payroll-cycle
// path: payroll.service.ts only ever sets REIMBURSED and payrollItemId
// together, so the status check below is sufficient to reject a claim
// that was already reimbursed that way — there's no APPROVED-with-
// payrollItemId-set state to separately guard against.
export async function reimburseExpenseClaim(
  organizationId: string,
  claimId: string,
  actorId: string,
  input: ReimburseExpenseClaimInput,
) {
  return prisma.$transaction(async (tx) => {
    const locked = await lockExpenseClaim(tx, organizationId, claimId);

    if (locked.status !== ExpenseClaimStatus.APPROVED) {
      throw AppError.conflict(
        "INVALID_STATUS_TRANSITION",
        `Cannot reimburse an expense claim in status ${locked.status}`,
      );
    }

    await tx.expenseClaim.update({
      where: { id: claimId },
      data: {
        status: ExpenseClaimStatus.REIMBURSED,
        disbursementMethod: input.disbursementMethod,
        disbursementReference: input.disbursementReference,
        disbursedAt: new Date(),
        disbursedBy: actorId,
      },
    });

    await recordAudit(
      {
        organizationId,
        actorId,
        action: "EXPENSE_CLAIM_REIMBURSED",
        resourceType: "ExpenseClaim",
        resourceId: claimId,
        metadata: {
          disbursementMethod: input.disbursementMethod,
          disbursementReference: input.disbursementReference,
        },
      },
      tx,
    );

    const claim = await reloadExpenseClaim(tx, claimId);

    // NOTIF-04 — link back only, never the amount or disbursement reference.
    await emitNotificationEvent(tx, {
      organizationId,
      eventType: "expense.claim.reimbursed",
      recipientUserIds: [claim.employee.userId],
      data: { categoryName: claim.category.name },
      relatedResourceType: "ExpenseClaim",
      relatedResourceId: claimId,
    });

    return claim;
  });
}

// ---------------------------------------------------------------------------
// Receipts — Sec 13.3 / DB2-06
// ---------------------------------------------------------------------------

export async function addExpenseReceipt(
  organizationId: string,
  claimId: string,
  userId: string,
  file: { buffer: Buffer; mimetype: string; originalname: string; size: number },
) {
  const claim = await getOwnedDraftClaim(organizationId, claimId, userId);

  const existingCount = await prisma.expenseReceipt.count({ where: { expenseClaimId: claim.id } });
  if (existingCount >= MAX_RECEIPTS_PER_CLAIM) {
    throw AppError.businessRule(
      "RECEIPT_LIMIT_EXCEEDED",
      `An expense claim may have at most ${MAX_RECEIPTS_PER_CLAIM} receipts`,
    );
  }

  const storageKey = await storageAdapter.save(file.buffer, extensionForMimeType(file.mimetype));

  return prisma.expenseReceipt.create({
    data: {
      expenseClaimId: claim.id,
      storageKey,
      fileName: file.originalname,
      mimeType: file.mimetype,
      sizeBytes: file.size,
    },
  });
}

// Sec 13.3 — ownership/role checked on every read, same access-control
// property a signed URL would give without needing real object storage.
export async function getExpenseReceiptForDownload(
  organizationId: string,
  claimId: string,
  receiptId: string,
  requester: { userId: string; role: AuthContext["role"] },
) {
  const claim = await prisma.expenseClaim.findFirst({
    where: { id: claimId, organizationId },
    include: { employee: { select: { userId: true } } },
  });
  if (!claim) {
    throw AppError.notFound("ExpenseClaim");
  }

  const isOwner = claim.employee.userId === requester.userId;
  const isHr = requester.role === "HR_ADMIN" || requester.role === "SUPER_ADMIN";
  if (!isOwner && !isHr) {
    throw AppError.forbidden();
  }

  const receipt = await prisma.expenseReceipt.findFirst({
    where: { id: receiptId, expenseClaimId: claimId },
  });
  if (!receipt) {
    throw AppError.notFound("ExpenseReceipt");
  }

  return receipt;
}

// ---------------------------------------------------------------------------
// Bank disbursement — BANK-01 (Wave 3)
// ---------------------------------------------------------------------------

// Same eligibility as reimburseExpenseClaim: APPROVED and not already
// attached to a payroll run. A read-only export — it doesn't mark
// anything REIMBURSED; HR still does that per claim via POST .../reimburse
// once the bank transfer is confirmed, same as recording any other
// standalone reimbursement (EXP-09..11).
export async function generateExpenseDisbursementCsv(
  organizationId: string,
): Promise<{ csv: string; filename: string }> {
  const [claims, organization] = await Promise.all([
    prisma.expenseClaim.findMany({
      where: { organizationId, status: ExpenseClaimStatus.APPROVED, payrollItemId: null },
      include: {
        employee: {
          select: {
            employeeNo: true,
            bankName: true,
            bankAccountName: true,
            bankAccountNumber: true,
          },
        },
        category: { select: { name: true } },
      },
      orderBy: { employee: { employeeNo: "asc" } },
    }),
    prisma.organization.findUniqueOrThrow({ where: { id: organizationId }, select: { currency: true } }),
  ]);

  const csv = buildCsv(
    ["Employee No", "Account Name", "Bank Name", "Account Number", "Amount", "Currency", "Reference"],
    claims.map((claim) => [
      claim.employee.employeeNo,
      claim.employee.bankAccountName ?? "",
      claim.employee.bankName ?? "",
      claim.employee.bankAccountNumber ?? "",
      claim.amount.toString(),
      organization.currency,
      `${claim.category.name} reimbursement (${claim.id})`,
    ]),
  );

  return { csv, filename: `expense-disbursement-${new Date().toISOString().slice(0, 10)}.csv` };
}
