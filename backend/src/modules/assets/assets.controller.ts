import type { Request, Response } from "express";
import { requireAuthContext, requireIdParam } from "@common/http/requestHelpers";
import {
  assignAssetSchema,
  createAssetSchema,
  listAssetsQuerySchema,
  returnAssetSchema,
  updateAssetSchema,
} from "@modules/assets/assets.schema";
import {
  assignAsset,
  createAsset,
  listAssetAssignments,
  listAssets,
  returnAsset,
  updateAsset,
} from "@modules/assets/assets.service";

export async function listAssetsHandler(req: Request, res: Response): Promise<void> {
  const { organizationId, userId, role } = requireAuthContext(req);
  const query = listAssetsQuerySchema.parse(req.query);
  const result = await listAssets(organizationId, { userId, role }, query);
  res.json({ success: true, data: result.items, meta: result.meta });
}

export async function createAssetHandler(req: Request, res: Response): Promise<void> {
  const { organizationId, userId } = requireAuthContext(req);
  const input = createAssetSchema.parse(req.body);
  const asset = await createAsset(organizationId, input, userId);
  res.status(201).json({ success: true, data: asset });
}

export async function updateAssetHandler(req: Request, res: Response): Promise<void> {
  const { organizationId, userId } = requireAuthContext(req);
  const input = updateAssetSchema.parse(req.body);
  const asset = await updateAsset(organizationId, requireIdParam(req), input, userId);
  res.json({ success: true, data: asset });
}

export async function assignAssetHandler(req: Request, res: Response): Promise<void> {
  const { organizationId, userId } = requireAuthContext(req);
  const input = assignAssetSchema.parse(req.body);
  const asset = await assignAsset(organizationId, requireIdParam(req), input, userId);
  res.json({ success: true, data: asset });
}

export async function returnAssetHandler(req: Request, res: Response): Promise<void> {
  const { organizationId, userId } = requireAuthContext(req);
  const input = returnAssetSchema.parse(req.body);
  const asset = await returnAsset(organizationId, requireIdParam(req), input, userId);
  res.json({ success: true, data: asset });
}

export async function listAssetAssignmentsHandler(req: Request, res: Response): Promise<void> {
  const { organizationId } = requireAuthContext(req);
  const assignments = await listAssetAssignments(organizationId, requireIdParam(req));
  res.json({ success: true, data: assignments });
}
