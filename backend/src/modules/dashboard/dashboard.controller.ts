import type { Request, Response } from "express";
import { requireAuthContext } from "@common/http/requestHelpers";
import { getEmployeeDashboard, getHrDashboard } from "@modules/dashboard/dashboard.service";

export async function getHrDashboardHandler(req: Request, res: Response): Promise<void> {
  const { organizationId } = requireAuthContext(req);
  const data = await getHrDashboard(organizationId);
  res.json({ success: true, data });
}

export async function getEmployeeDashboardHandler(req: Request, res: Response): Promise<void> {
  const { organizationId, userId } = requireAuthContext(req);
  const data = await getEmployeeDashboard(organizationId, userId);
  res.json({ success: true, data });
}
