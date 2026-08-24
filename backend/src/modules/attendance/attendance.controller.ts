import type { Request, Response } from "express";
import { requireAuthContext, requireIdParam } from "@common/http/requestHelpers";
import {
  correctAttendanceSchema,
  listAttendanceQuerySchema,
} from "@modules/attendance/attendance.schema";
import {
  checkIn,
  checkOut,
  correctAttendance,
  listAttendance,
} from "@modules/attendance/attendance.service";

export async function checkInHandler(req: Request, res: Response): Promise<void> {
  const { organizationId, userId } = requireAuthContext(req);
  const record = await checkIn(organizationId, userId);
  res.status(201).json({ success: true, data: record });
}

export async function checkOutHandler(req: Request, res: Response): Promise<void> {
  const { organizationId, userId } = requireAuthContext(req);
  const record = await checkOut(organizationId, userId);
  res.json({ success: true, data: record });
}

export async function listAttendanceHandler(req: Request, res: Response): Promise<void> {
  const { organizationId, userId, role } = requireAuthContext(req);
  const query = listAttendanceQuerySchema.parse(req.query);
  const result = await listAttendance(organizationId, { userId, role }, query);
  res.json({ success: true, data: result.items, meta: result.meta });
}

export async function correctAttendanceHandler(req: Request, res: Response): Promise<void> {
  const { organizationId, userId } = requireAuthContext(req);
  const input = correctAttendanceSchema.parse(req.body);
  const record = await correctAttendance(organizationId, requireIdParam(req), input, userId);
  res.json({ success: true, data: record });
}
