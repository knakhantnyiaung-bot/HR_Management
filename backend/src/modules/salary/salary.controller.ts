import type { Request, Response } from "express";
import { AppError } from "@common/errors/AppError";
import { requireAuthContext, requireParam } from "@common/http/requestHelpers";
import { getEmployeeByUserId } from "@modules/employees/employees.service";
import { upsertSalaryProfileSchema } from "@modules/salary/salary.schema";
import {
  getCurrentSalaryProfile,
  listSalaryProfileHistory,
  upsertSalaryProfile,
} from "@modules/salary/salary.service";

// HLD section 10 RBAC table: Salary column — HR Admin "Manage", Employee
// "Own limited view". An Employee may read their own current profile only;
// they can't write, and can't see another employee's or the full history.
async function assertViewableByCaller(
  req: Request,
  employeeId: string,
): Promise<void> {
  const { organizationId, userId, role } = requireAuthContext(req);
  if (role !== "EMPLOYEE") return;

  const own = await getEmployeeByUserId(organizationId, userId);
  if (own.id !== employeeId) {
    throw AppError.forbidden("You may only view your own salary profile");
  }
}

export async function getSalaryProfileHandler(req: Request, res: Response): Promise<void> {
  const { organizationId } = requireAuthContext(req);
  const employeeId = requireParam(req, "id");
  await assertViewableByCaller(req, employeeId);

  const profile = await getCurrentSalaryProfile(organizationId, employeeId);
  res.json({ success: true, data: profile });
}

export async function updateSalaryProfileHandler(req: Request, res: Response): Promise<void> {
  const { organizationId, userId } = requireAuthContext(req);
  const employeeId = requireParam(req, "id");
  const input = upsertSalaryProfileSchema.parse(req.body);

  const profile = await upsertSalaryProfile(organizationId, employeeId, input, userId);
  res.status(201).json({ success: true, data: profile });
}

export async function listSalaryProfileHistoryHandler(req: Request, res: Response): Promise<void> {
  const { organizationId } = requireAuthContext(req);
  const employeeId = requireParam(req, "id");

  const history = await listSalaryProfileHistory(organizationId, employeeId);
  res.json({ success: true, data: history });
}
