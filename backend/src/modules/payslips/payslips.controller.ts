import type { Request, Response } from "express";
import { requireAuthContext, requireIdParam } from "@common/http/requestHelpers";
import { listPayslipsQuerySchema } from "@modules/payslips/payslips.schema";
import { getPayslipById, listPayslips } from "@modules/payslips/payslips.service";

export async function listPayslipsHandler(req: Request, res: Response): Promise<void> {
  const { organizationId, userId, role } = requireAuthContext(req);
  const query = listPayslipsQuerySchema.parse(req.query);
  const result = await listPayslips(organizationId, { userId, role }, query);
  res.json({ success: true, data: result.items, meta: result.meta });
}

export async function getPayslipHandler(req: Request, res: Response): Promise<void> {
  const { organizationId, userId, role } = requireAuthContext(req);
  const payslip = await getPayslipById(organizationId, { userId, role }, requireIdParam(req));
  res.json({ success: true, data: payslip });
}
