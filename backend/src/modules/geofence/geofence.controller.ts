import type { Request, Response } from "express";
import { requireAuthContext, requireIdParam } from "@common/http/requestHelpers";
import {
  createGeofenceZoneSchema,
  updateGeofencePolicySchema,
  updateGeofenceZoneSchema,
} from "@modules/geofence/geofence.schema";
import {
  createGeofenceZone,
  deleteGeofenceZone,
  getGeofencePolicy,
  listGeofenceZones,
  updateGeofencePolicy,
  updateGeofenceZone,
} from "@modules/geofence/geofence.service";

export async function getGeofencePolicyHandler(req: Request, res: Response): Promise<void> {
  const { organizationId } = requireAuthContext(req);
  const policy = await getGeofencePolicy(organizationId);
  res.json({ success: true, data: policy });
}

export async function updateGeofencePolicyHandler(req: Request, res: Response): Promise<void> {
  const { organizationId, userId } = requireAuthContext(req);
  const input = updateGeofencePolicySchema.parse(req.body);
  const policy = await updateGeofencePolicy(organizationId, input.locationPolicy, userId);
  res.json({ success: true, data: policy });
}

export async function listGeofenceZonesHandler(req: Request, res: Response): Promise<void> {
  const { organizationId } = requireAuthContext(req);
  const zones = await listGeofenceZones(organizationId);
  res.json({ success: true, data: zones });
}

export async function createGeofenceZoneHandler(req: Request, res: Response): Promise<void> {
  const { organizationId, userId } = requireAuthContext(req);
  const input = createGeofenceZoneSchema.parse(req.body);
  const zone = await createGeofenceZone(organizationId, input, userId);
  res.status(201).json({ success: true, data: zone });
}

export async function updateGeofenceZoneHandler(req: Request, res: Response): Promise<void> {
  const { organizationId, userId } = requireAuthContext(req);
  const input = updateGeofenceZoneSchema.parse(req.body);
  const zone = await updateGeofenceZone(organizationId, requireIdParam(req), input, userId);
  res.json({ success: true, data: zone });
}

export async function deleteGeofenceZoneHandler(req: Request, res: Response): Promise<void> {
  const { organizationId, userId } = requireAuthContext(req);
  const zone = await deleteGeofenceZone(organizationId, requireIdParam(req), userId);
  res.json({ success: true, data: zone });
}
