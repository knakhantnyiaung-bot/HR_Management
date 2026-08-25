import type { Request, Response } from "express";
import { requireAuthContext, requireIdParam } from "@common/http/requestHelpers";
import {
  createPositionSchema,
  listPositionsQuerySchema,
  updatePositionSchema,
} from "@modules/positions/positions.schema";
import { createPosition, listPositions, updatePosition } from "@modules/positions/positions.service";

export async function listPositionsHandler(req: Request, res: Response): Promise<void> {
  const { organizationId } = requireAuthContext(req);
  const query = listPositionsQuerySchema.parse(req.query);
  const result = await listPositions(organizationId, query);
  res.json({ success: true, data: result.items, meta: result.meta });
}

export async function createPositionHandler(req: Request, res: Response): Promise<void> {
  const { organizationId, userId } = requireAuthContext(req);
  const input = createPositionSchema.parse(req.body);
  const position = await createPosition(organizationId, input, userId);
  res.status(201).json({ success: true, data: position });
}

export async function updatePositionHandler(req: Request, res: Response): Promise<void> {
  const { organizationId, userId } = requireAuthContext(req);
  const input = updatePositionSchema.parse(req.body);
  const position = await updatePosition(organizationId, requireIdParam(req), input, userId);
  res.json({ success: true, data: position });
}
