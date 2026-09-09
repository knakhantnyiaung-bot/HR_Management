import { Router } from "express";
import { requireAuth, requireRole } from "@common/auth/requireAuth";
import { asyncHandler } from "@common/middleware/asyncHandler";
import { receiptUpload } from "@common/upload/multerConfig";
import {
  approveExpenseClaimHandler,
  cancelExpenseClaimHandler,
  createExpenseCategoryHandler,
  createExpenseClaimHandler,
  downloadExpenseReceiptHandler,
  listExpenseCategoriesHandler,
  listExpenseClaimsHandler,
  reimburseExpenseClaimHandler,
  rejectExpenseClaimHandler,
  submitExpenseClaimHandler,
  updateExpenseClaimHandler,
  uploadExpenseReceiptHandler,
} from "@modules/expenses/expenses.controller";

// Sprint 2 HLD Sec 13/Appendix B, Handbook EXP-*. Categories are HR-managed;
// claims are self-service with HR approval, same authority tier as leave/OT.
export const expensesRouter = Router();

const HR_ROLES = ["HR_ADMIN", "SUPER_ADMIN"] as const;

expensesRouter.get("/categories", requireAuth, asyncHandler(listExpenseCategoriesHandler));
expensesRouter.post(
  "/categories",
  requireAuth,
  requireRole(...HR_ROLES),
  asyncHandler(createExpenseCategoryHandler),
);

expensesRouter.post("/claims", requireAuth, asyncHandler(createExpenseClaimHandler));
expensesRouter.get("/claims", requireAuth, asyncHandler(listExpenseClaimsHandler));
expensesRouter.patch("/claims/:id", requireAuth, asyncHandler(updateExpenseClaimHandler));
expensesRouter.post("/claims/:id/submit", requireAuth, asyncHandler(submitExpenseClaimHandler));
expensesRouter.post("/claims/:id/cancel", requireAuth, asyncHandler(cancelExpenseClaimHandler));
expensesRouter.post(
  "/claims/:id/approve",
  requireAuth,
  requireRole(...HR_ROLES),
  asyncHandler(approveExpenseClaimHandler),
);
expensesRouter.post(
  "/claims/:id/reject",
  requireAuth,
  requireRole(...HR_ROLES),
  asyncHandler(rejectExpenseClaimHandler),
);
// EXP-09..11 — reimburse an APPROVED claim outside a payroll run.
expensesRouter.post(
  "/claims/:id/reimburse",
  requireAuth,
  requireRole(...HR_ROLES),
  asyncHandler(reimburseExpenseClaimHandler),
);

expensesRouter.post(
  "/claims/:id/receipts",
  requireAuth,
  receiptUpload.array("files", 5),
  asyncHandler(uploadExpenseReceiptHandler),
);
expensesRouter.get(
  "/claims/:id/receipts/:receiptId/file",
  requireAuth,
  asyncHandler(downloadExpenseReceiptHandler),
);
