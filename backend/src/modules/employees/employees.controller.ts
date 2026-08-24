import type { Request, Response } from "express";
import { AppError } from "@common/errors/AppError";
import { requireAuthContext, requireIdParam } from "@common/http/requestHelpers";
import {
  createEmployeeSchema,
  listEmployeesQuerySchema,
  updateEmployeeSchema,
} from "@modules/employees/employees.schema";
import {
  activateEmployee,
  createEmployee,
  deactivateEmployee,
  getEmployeeById,
  listEmployees,
  terminateEmployee,
  updateEmployee,
} from "@modules/employees/employees.service";

export async function listEmployeesHandler(req: Request, res: Response): Promise<void> {
  const { organizationId } = requireAuthContext(req);
  const query = listEmployeesQuerySchema.parse(req.query);
  const result = await listEmployees(organizationId, query);
  res.json({ success: true, data: result.items, meta: result.meta });
}

export async function createEmployeeHandler(req: Request, res: Response): Promise<void> {
  const { organizationId, userId } = requireAuthContext(req);
  const input = createEmployeeSchema.parse(req.body);
  const result = await createEmployee(organizationId, input, userId);
  res.status(201).json({
    success: true,
    data: {
      ...result.employee,
      ...(result.temporaryPassword ? { temporaryPassword: result.temporaryPassword } : {}),
    },
  });
}

export async function getEmployeeHandler(req: Request, res: Response): Promise<void> {
  const { organizationId, userId, role } = requireAuthContext(req);
  const employee = await getEmployeeById(organizationId, requireIdParam(req));

  if (role === "EMPLOYEE" && employee.user.id !== userId) {
    throw AppError.forbidden("You may only view your own employee record");
  }

  res.json({ success: true, data: employee });
}

export async function updateEmployeeHandler(req: Request, res: Response): Promise<void> {
  const { organizationId, userId } = requireAuthContext(req);
  const input = updateEmployeeSchema.parse(req.body);
  const employee = await updateEmployee(organizationId, requireIdParam(req), input, userId);
  res.json({ success: true, data: employee });
}

export async function activateEmployeeHandler(req: Request, res: Response): Promise<void> {
  const { organizationId, userId } = requireAuthContext(req);
  const employee = await activateEmployee(organizationId, requireIdParam(req), userId);
  res.json({ success: true, data: employee });
}

export async function deactivateEmployeeHandler(req: Request, res: Response): Promise<void> {
  const { organizationId, userId } = requireAuthContext(req);
  const employee = await deactivateEmployee(organizationId, requireIdParam(req), userId);
  res.json({ success: true, data: employee });
}

export async function terminateEmployeeHandler(req: Request, res: Response): Promise<void> {
  const { organizationId, userId } = requireAuthContext(req);
  const employee = await terminateEmployee(organizationId, requireIdParam(req), userId);
  res.json({ success: true, data: employee });
}
