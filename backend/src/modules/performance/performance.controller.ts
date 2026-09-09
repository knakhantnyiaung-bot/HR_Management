import type { Request, Response } from "express";
import { requireAuthContext, requireIdParam } from "@common/http/requestHelpers";
import {
  createReviewCycleSchema,
  listReviewCyclesQuerySchema,
  listReviewsQuerySchema,
  submitManagerReviewSchema,
  submitSelfReviewSchema,
} from "@modules/performance/performance.schema";
import {
  closeReviewCycle,
  createReviewCycle,
  getReview,
  listReviewCycles,
  listReviews,
  openReviewCycle,
  submitManagerReview,
  submitSelfReview,
} from "@modules/performance/performance.service";

export async function listReviewCyclesHandler(req: Request, res: Response): Promise<void> {
  const { organizationId } = requireAuthContext(req);
  const query = listReviewCyclesQuerySchema.parse(req.query);
  const result = await listReviewCycles(organizationId, query);
  res.json({ success: true, data: result.items, meta: result.meta });
}

export async function createReviewCycleHandler(req: Request, res: Response): Promise<void> {
  const { organizationId, userId } = requireAuthContext(req);
  const input = createReviewCycleSchema.parse(req.body);
  const cycle = await createReviewCycle(organizationId, input, userId);
  res.status(201).json({ success: true, data: cycle });
}

export async function openReviewCycleHandler(req: Request, res: Response): Promise<void> {
  const { organizationId, userId } = requireAuthContext(req);
  const cycle = await openReviewCycle(organizationId, requireIdParam(req), userId);
  res.json({ success: true, data: cycle });
}

export async function closeReviewCycleHandler(req: Request, res: Response): Promise<void> {
  const { organizationId, userId } = requireAuthContext(req);
  const cycle = await closeReviewCycle(organizationId, requireIdParam(req), userId);
  res.json({ success: true, data: cycle });
}

export async function listReviewsHandler(req: Request, res: Response): Promise<void> {
  const { organizationId, userId, role } = requireAuthContext(req);
  const query = listReviewsQuerySchema.parse(req.query);
  const result = await listReviews(organizationId, { userId, role }, query);
  res.json({ success: true, data: result.items, meta: result.meta });
}

export async function getReviewHandler(req: Request, res: Response): Promise<void> {
  const { organizationId, userId, role } = requireAuthContext(req);
  const review = await getReview(organizationId, requireIdParam(req), { userId, role });
  res.json({ success: true, data: review });
}

export async function submitSelfReviewHandler(req: Request, res: Response): Promise<void> {
  const { organizationId, userId, role } = requireAuthContext(req);
  const input = submitSelfReviewSchema.parse(req.body);
  const review = await submitSelfReview(organizationId, requireIdParam(req), input, { userId, role });
  res.json({ success: true, data: review });
}

export async function submitManagerReviewHandler(req: Request, res: Response): Promise<void> {
  const { organizationId, userId, role } = requireAuthContext(req);
  const input = submitManagerReviewSchema.parse(req.body);
  const review = await submitManagerReview(organizationId, requireIdParam(req), input, { userId, role });
  res.json({ success: true, data: review });
}
