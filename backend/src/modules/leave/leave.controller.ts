import type { Request, Response } from "express";
import { requireAuthContext, requireIdParam } from "@common/http/requestHelpers";
import { getEmployeeByUserId } from "@modules/employees/employees.service";
import {
  createLeaveRequestSchema,
  createLeaveTypeSchema,
  grantLeaveBalanceSchema,
  listLeaveBalancesQuerySchema,
  listLeaveRequestsQuerySchema,
} from "@modules/leave/leave.schema";
import {
  approveLeaveRequest,
  cancelLeaveRequest,
  createLeaveRequest,
  createLeaveType,
  grantLeaveBalance,
  listLeaveBalances,
  listLeaveRequests,
  listLeaveTypes,
  rejectLeaveRequest,
} from "@modules/leave/leave.service";

export async function listLeaveTypesHandler(req: Request, res: Response): Promise<void> {
  const { organizationId } = requireAuthContext(req);
  const types = await listLeaveTypes(organizationId);
  res.json({ success: true, data: types });
}

export async function createLeaveTypeHandler(req: Request, res: Response): Promise<void> {
  const { organizationId } = requireAuthContext(req);
  const input = createLeaveTypeSchema.parse(req.body);
  const type = await createLeaveType(organizationId, input);
  res.status(201).json({ success: true, data: type });
}

export async function listLeaveBalancesHandler(req: Request, res: Response): Promise<void> {
  const { organizationId, userId, role } = requireAuthContext(req);
  const query = listLeaveBalancesQuerySchema.parse(req.query);
  const balances = await listLeaveBalances(organizationId, { userId, role }, query);
  res.json({ success: true, data: balances });
}

export async function grantLeaveBalanceHandler(req: Request, res: Response): Promise<void> {
  const { organizationId, userId } = requireAuthContext(req);
  const input = grantLeaveBalanceSchema.parse(req.body);
  const balance = await grantLeaveBalance(organizationId, input, userId);
  res.status(201).json({ success: true, data: balance });
}

export async function createLeaveRequestHandler(req: Request, res: Response): Promise<void> {
  const { organizationId, userId } = requireAuthContext(req);
  const input = createLeaveRequestSchema.parse(req.body);
  const request = await createLeaveRequest(organizationId, userId, input);
  res.status(201).json({ success: true, data: request });
}

export async function listLeaveRequestsHandler(req: Request, res: Response): Promise<void> {
  const { organizationId, userId, role } = requireAuthContext(req);
  const query = listLeaveRequestsQuerySchema.parse(req.query);
  const result = await listLeaveRequests(organizationId, { userId, role }, query);
  res.json({ success: true, data: result.items, meta: result.meta });
}

export async function approveLeaveRequestHandler(req: Request, res: Response): Promise<void> {
  const { organizationId, userId } = requireAuthContext(req);
  const request = await approveLeaveRequest(organizationId, requireIdParam(req), userId);
  res.json({ success: true, data: request });
}

export async function rejectLeaveRequestHandler(req: Request, res: Response): Promise<void> {
  const { organizationId, userId } = requireAuthContext(req);
  const request = await rejectLeaveRequest(organizationId, requireIdParam(req), userId);
  res.json({ success: true, data: request });
}

export async function cancelLeaveRequestHandler(req: Request, res: Response): Promise<void> {
  const { organizationId, userId, role } = requireAuthContext(req);
  const restrictToEmployeeId =
    role === "EMPLOYEE" ? (await getEmployeeByUserId(organizationId, userId)).id : undefined;
  const request = await cancelLeaveRequest(
    organizationId,
    requireIdParam(req),
    userId,
    restrictToEmployeeId,
  );
  res.json({ success: true, data: request });
}
