import type { Request, Response } from "express";
import { requireAuthContext, requireIdParam } from "@common/http/requestHelpers";
import { createPayrollRunSchema, listPayrollRunsQuerySchema } from "@modules/payroll/payroll.schema";
import {
  approvePayrollRun,
  calculatePayrollRun,
  createPayrollRun,
  getPayrollRunById,
  listPayrollRuns,
  markPayrollRunPaid,
} from "@modules/payroll/payroll.service";

export async function createPayrollRunHandler(req: Request, res: Response): Promise<void> {
  const { organizationId, userId } = requireAuthContext(req);
  const input = createPayrollRunSchema.parse(req.body);
  const run = await createPayrollRun(organizationId, input.period, userId);
  res.status(201).json({ success: true, data: run });
}

export async function listPayrollRunsHandler(req: Request, res: Response): Promise<void> {
  const { organizationId } = requireAuthContext(req);
  const query = listPayrollRunsQuerySchema.parse(req.query);
  const result = await listPayrollRuns(organizationId, query);
  res.json({ success: true, data: result.items, meta: result.meta });
}

export async function getPayrollRunHandler(req: Request, res: Response): Promise<void> {
  const { organizationId } = requireAuthContext(req);
  const run = await getPayrollRunById(organizationId, requireIdParam(req));
  res.json({ success: true, data: run });
}

export async function calculatePayrollRunHandler(req: Request, res: Response): Promise<void> {
  const { organizationId, userId } = requireAuthContext(req);
  const run = await calculatePayrollRun(organizationId, requireIdParam(req), userId);
  res.json({ success: true, data: run });
}

export async function approvePayrollRunHandler(req: Request, res: Response): Promise<void> {
  const { organizationId, userId } = requireAuthContext(req);
  const run = await approvePayrollRun(organizationId, requireIdParam(req), userId);
  res.json({ success: true, data: run });
}

export async function markPayrollRunPaidHandler(req: Request, res: Response): Promise<void> {
  const { organizationId, userId } = requireAuthContext(req);
  const run = await markPayrollRunPaid(organizationId, requireIdParam(req), userId);
  res.json({ success: true, data: run });
}
