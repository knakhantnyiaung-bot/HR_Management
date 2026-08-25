import type { Request, Response } from "express";
import { requireAuthContext, requireIdParam } from "@common/http/requestHelpers";
import {
  createDepartmentSchema,
  listDepartmentsQuerySchema,
  updateDepartmentSchema,
} from "@modules/departments/departments.schema";
import {
  createDepartment,
  listDepartments,
  updateDepartment,
} from "@modules/departments/departments.service";

export async function listDepartmentsHandler(req: Request, res: Response): Promise<void> {
  const { organizationId } = requireAuthContext(req);
  const query = listDepartmentsQuerySchema.parse(req.query);
  const result = await listDepartments(organizationId, query);
  res.json({ success: true, data: result.items, meta: result.meta });
}

export async function createDepartmentHandler(req: Request, res: Response): Promise<void> {
  const { organizationId, userId } = requireAuthContext(req);
  const input = createDepartmentSchema.parse(req.body);
  const department = await createDepartment(organizationId, input, userId);
  res.status(201).json({ success: true, data: department });
}

export async function updateDepartmentHandler(req: Request, res: Response): Promise<void> {
  const { organizationId, userId } = requireAuthContext(req);
  const input = updateDepartmentSchema.parse(req.body);
  const department = await updateDepartment(organizationId, requireIdParam(req), input, userId);
  res.json({ success: true, data: department });
}
