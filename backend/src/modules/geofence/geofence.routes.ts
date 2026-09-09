import { Router } from "express";
import { requireAuth, requireRole } from "@common/auth/requireAuth";
import { asyncHandler } from "@common/middleware/asyncHandler";
import {
  createGeofenceZoneHandler,
  deleteGeofenceZoneHandler,
  getGeofencePolicyHandler,
  listGeofenceZonesHandler,
  updateGeofencePolicyHandler,
  updateGeofenceZoneHandler,
} from "@modules/geofence/geofence.controller";

// Sprint 2 HLD Sec 11/Appendix B — mounted at /organization alongside (not
// nested under) organizations.routes.ts, same pattern as departments/
// positions. HR Admin/Super Admin manage; no Employee access (GEO-09).
export const geofenceRouter = Router();

const HR_ROLES = ["HR_ADMIN", "SUPER_ADMIN"] as const;

geofenceRouter.get(
  "/geofence-policy",
  requireAuth,
  requireRole(...HR_ROLES),
  asyncHandler(getGeofencePolicyHandler),
);
geofenceRouter.patch(
  "/geofence-policy",
  requireAuth,
  requireRole(...HR_ROLES),
  asyncHandler(updateGeofencePolicyHandler),
);
geofenceRouter.get(
  "/geofence-zones",
  requireAuth,
  requireRole(...HR_ROLES),
  asyncHandler(listGeofenceZonesHandler),
);
geofenceRouter.post(
  "/geofence-zones",
  requireAuth,
  requireRole(...HR_ROLES),
  asyncHandler(createGeofenceZoneHandler),
);
geofenceRouter.patch(
  "/geofence-zones/:id",
  requireAuth,
  requireRole(...HR_ROLES),
  asyncHandler(updateGeofenceZoneHandler),
);
geofenceRouter.delete(
  "/geofence-zones/:id",
  requireAuth,
  requireRole(...HR_ROLES),
  asyncHandler(deleteGeofenceZoneHandler),
);
