import type { Request, Response } from "express";
import { AppError } from "@common/errors/AppError";
import { requireAuthContext, requireIdParam, requireParam } from "@common/http/requestHelpers";
import {
  createExpenseCategorySchema,
  createExpenseClaimSchema,
  listExpenseClaimsQuerySchema,
  rejectExpenseClaimSchema,
  updateExpenseClaimSchema,
} from "@modules/expenses/expenses.schema";
import {
  addExpenseReceipt,
  approveExpenseClaim,
  cancelExpenseClaim,
  createExpenseCategory,
  createExpenseClaim,
  getExpenseReceiptForDownload,
  listExpenseCategories,
  listExpenseClaims,
  rejectExpenseClaim,
  submitExpenseClaim,
  updateExpenseClaim,
} from "@modules/expenses/expenses.service";
import { storageAdapter } from "@common/storage/storageAdapter";

export async function listExpenseCategoriesHandler(req: Request, res: Response): Promise<void> {
  const { organizationId } = requireAuthContext(req);
  const categories = await listExpenseCategories(organizationId);
  res.json({ success: true, data: categories });
}

export async function createExpenseCategoryHandler(req: Request, res: Response): Promise<void> {
  const { organizationId, userId } = requireAuthContext(req);
  const input = createExpenseCategorySchema.parse(req.body);
  const category = await createExpenseCategory(organizationId, input, userId);
  res.status(201).json({ success: true, data: category });
}

export async function createExpenseClaimHandler(req: Request, res: Response): Promise<void> {
  const { organizationId, userId } = requireAuthContext(req);
  const input = createExpenseClaimSchema.parse(req.body);
  const claim = await createExpenseClaim(organizationId, userId, input);
  res.status(201).json({ success: true, data: claim });
}

export async function listExpenseClaimsHandler(req: Request, res: Response): Promise<void> {
  const { organizationId, userId, role } = requireAuthContext(req);
  const query = listExpenseClaimsQuerySchema.parse(req.query);
  const result = await listExpenseClaims(organizationId, { userId, role }, query);
  res.json({ success: true, data: result.items, meta: result.meta });
}

export async function updateExpenseClaimHandler(req: Request, res: Response): Promise<void> {
  const { organizationId, userId } = requireAuthContext(req);
  const input = updateExpenseClaimSchema.parse(req.body);
  const claim = await updateExpenseClaim(organizationId, requireIdParam(req), userId, input);
  res.json({ success: true, data: claim });
}

export async function submitExpenseClaimHandler(req: Request, res: Response): Promise<void> {
  const { organizationId, userId } = requireAuthContext(req);
  const claim = await submitExpenseClaim(organizationId, requireIdParam(req), userId);
  res.json({ success: true, data: claim });
}

export async function cancelExpenseClaimHandler(req: Request, res: Response): Promise<void> {
  const { organizationId, userId } = requireAuthContext(req);
  const claim = await cancelExpenseClaim(organizationId, requireIdParam(req), userId);
  res.json({ success: true, data: claim });
}

export async function approveExpenseClaimHandler(req: Request, res: Response): Promise<void> {
  const { organizationId, userId } = requireAuthContext(req);
  const claim = await approveExpenseClaim(organizationId, requireIdParam(req), userId);
  res.json({ success: true, data: claim });
}

export async function rejectExpenseClaimHandler(req: Request, res: Response): Promise<void> {
  const { organizationId, userId } = requireAuthContext(req);
  const input = rejectExpenseClaimSchema.parse(req.body);
  const claim = await rejectExpenseClaim(organizationId, requireIdParam(req), userId, input.reason);
  res.json({ success: true, data: claim });
}

export async function uploadExpenseReceiptHandler(req: Request, res: Response): Promise<void> {
  const { organizationId, userId } = requireAuthContext(req);
  const claimId = requireIdParam(req);
  const files = (req.files as Express.Multer.File[] | undefined) ?? [];
  if (files.length === 0) {
    throw AppError.badRequest("NO_FILE_PROVIDED", "At least one file must be provided");
  }

  const receipts = [];
  for (const file of files) {
    receipts.push(
      await addExpenseReceipt(organizationId, claimId, userId, {
        buffer: file.buffer,
        mimetype: file.mimetype,
        originalname: file.originalname,
        size: file.size,
      }),
    );
  }

  res.status(201).json({ success: true, data: receipts });
}

export async function downloadExpenseReceiptHandler(req: Request, res: Response): Promise<void> {
  const { organizationId, userId, role } = requireAuthContext(req);
  const claimId = requireIdParam(req);
  const receiptId = requireParam(req, "receiptId");

  const receipt = await getExpenseReceiptForDownload(organizationId, claimId, receiptId, {
    userId,
    role,
  });

  res.setHeader("Content-Type", receipt.mimeType);
  res.setHeader("Content-Disposition", `attachment; filename="${receipt.fileName}"`);
  storageAdapter.readStream(receipt.storageKey).pipe(res);
}
