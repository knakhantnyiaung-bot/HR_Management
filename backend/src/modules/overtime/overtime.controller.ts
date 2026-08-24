import type { Request, Response } from "express";
import { requireAuthContext, requireIdParam } from "@common/http/requestHelpers";
import { getEmployeeByUserId } from "@modules/employees/employees.service";
import {
  createOvertimeRequestSchema,
  listOvertimeRequestsQuerySchema,
} from "@modules/overtime/overtime.schema";
import {
  approveOvertimeRequest,
  cancelOvertimeRequest,
  createOvertimeRequest,
  listOvertimeRequests,
  rejectOvertimeRequest,
} from "@modules/overtime/overtime.service";

export async function createOvertimeRequestHandler(req: Request, res: Response): Promise<void> {
  const { organizationId, userId } = requireAuthContext(req);
  const input = createOvertimeRequestSchema.parse(req.body);
  const request = await createOvertimeRequest(organizationId, userId, input);
  res.status(201).json({ success: true, data: request });
}

export async function listOvertimeRequestsHandler(req: Request, res: Response): Promise<void> {
  const { organizationId, userId, role } = requireAuthContext(req);
  const query = listOvertimeRequestsQuerySchema.parse(req.query);
  const result = await listOvertimeRequests(organizationId, { userId, role }, query);
  res.json({ success: true, data: result.items, meta: result.meta });
}

export async function approveOvertimeRequestHandler(req: Request, res: Response): Promise<void> {
  const { organizationId, userId } = requireAuthContext(req);
  const request = await approveOvertimeRequest(organizationId, requireIdParam(req), userId);
  res.json({ success: true, data: request });
}

export async function rejectOvertimeRequestHandler(req: Request, res: Response): Promise<void> {
  const { organizationId, userId } = requireAuthContext(req);
  const request = await rejectOvertimeRequest(organizationId, requireIdParam(req), userId);
  res.json({ success: true, data: request });
}

export async function cancelOvertimeRequestHandler(req: Request, res: Response): Promise<void> {
  const { organizationId, userId, role } = requireAuthContext(req);
  const restrictToEmployeeId =
    role === "EMPLOYEE" ? (await getEmployeeByUserId(organizationId, userId)).id : undefined;
  const request = await cancelOvertimeRequest(
    organizationId,
    requireIdParam(req),
    userId,
    restrictToEmployeeId,
  );
  res.json({ success: true, data: request });
}
