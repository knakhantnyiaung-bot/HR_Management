import { LocationPolicy, type WorkModel } from "@prisma/client";
import { prisma } from "@database/prisma";
import { AppError } from "@common/errors/AppError";
import { recordAudit } from "@modules/audit/audit.service";
import type {
  CreateGeofenceZoneInput,
  UpdateGeofenceZoneInput,
} from "@modules/geofence/geofence.schema";

interface LatLng {
  lat: number;
  lng: number;
}

// Handbook Sec 6.1 — haversine distance in meters. Deliberately not a
// Euclidean approximation on raw lat/lng: the degree-to-distance ratio
// isn't constant, and would misjudge zones at the 50-300m radii typical of
// an office geofence.
const EARTH_RADIUS_METERS = 6371000;

function toRadians(deg: number): number {
  return (deg * Math.PI) / 180;
}

export function haversineMeters(a: LatLng, b: LatLng): number {
  const dLat = toRadians(b.lat - a.lat);
  const dLng = toRadians(b.lng - a.lng);
  const lat1 = toRadians(a.lat);
  const lat2 = toRadians(b.lat);

  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
  return EARTH_RADIUS_METERS * c;
}

export async function getGeofencePolicy(organizationId: string) {
  const organization = await prisma.organization.findUniqueOrThrow({
    where: { id: organizationId },
    select: { locationPolicy: true },
  });
  return organization;
}

// GEO-09 — HR Admin/Super Admin only (enforced at the route level), audited.
export async function updateGeofencePolicy(
  organizationId: string,
  locationPolicy: LocationPolicy,
  actorId: string,
) {
  return prisma.$transaction(async (tx) => {
    const updated = await tx.organization.update({
      where: { id: organizationId },
      data: { locationPolicy },
      select: { locationPolicy: true },
    });

    await recordAudit(
      {
        organizationId,
        actorId,
        action: "GEOFENCE_POLICY_UPDATED",
        resourceType: "Organization",
        resourceId: organizationId,
        metadata: { locationPolicy },
      },
      tx,
    );

    return updated;
  });
}

export async function listGeofenceZones(organizationId: string) {
  return prisma.geofenceZone.findMany({
    where: { organizationId },
    orderBy: { createdAt: "asc" },
  });
}

export async function createGeofenceZone(
  organizationId: string,
  input: CreateGeofenceZoneInput,
  actorId: string,
) {
  return prisma.$transaction(async (tx) => {
    const zone = await tx.geofenceZone.create({
      data: { organizationId, ...input },
    });

    await recordAudit(
      {
        organizationId,
        actorId,
        action: "GEOFENCE_ZONE_CREATED",
        resourceType: "GeofenceZone",
        resourceId: zone.id,
        metadata: input,
      },
      tx,
    );

    return zone;
  });
}

export async function updateGeofenceZone(
  organizationId: string,
  zoneId: string,
  input: UpdateGeofenceZoneInput,
  actorId: string,
) {
  const existing = await prisma.geofenceZone.findFirst({ where: { id: zoneId, organizationId } });
  if (!existing) {
    throw AppError.notFound("GeofenceZone");
  }

  return prisma.$transaction(async (tx) => {
    const updated = await tx.geofenceZone.update({ where: { id: zoneId }, data: input });

    await recordAudit(
      {
        organizationId,
        actorId,
        action: "GEOFENCE_ZONE_UPDATED",
        resourceType: "GeofenceZone",
        resourceId: zoneId,
        metadata: input,
      },
      tx,
    );

    return updated;
  });
}

export async function deleteGeofenceZone(organizationId: string, zoneId: string, actorId: string) {
  const existing = await prisma.geofenceZone.findFirst({ where: { id: zoneId, organizationId } });
  if (!existing) {
    throw AppError.notFound("GeofenceZone");
  }

  return prisma.$transaction(async (tx) => {
    // Master-data pattern (MASTER-01): deactivate rather than hard-delete.
    const updated = await tx.geofenceZone.update({
      where: { id: zoneId },
      data: { status: "INACTIVE" },
    });

    await recordAudit(
      {
        organizationId,
        actorId,
        action: "GEOFENCE_ZONE_DEACTIVATED",
        resourceType: "GeofenceZone",
        resourceId: zoneId,
      },
      tx,
    );

    return updated;
  });
}

// Sprint 2 HLD Sec 11 — the attendance check-in integration point. GEO-02/
// GEO-03: enforcement only ever applies under GEOFENCE_ENFORCED for OFFICE
// employees; every other combination is a silent no-op, exactly like
// Sprint 1 v1.1's LOG_ONLY behavior. Throws before any AttendanceRecord is
// created — the caller (attendance.service.ts) is responsible for auditing
// the rejection, since no attendance row exists yet to attach it to.
export async function enforceGeofencePolicy(
  organizationId: string,
  employeeWorkModel: WorkModel,
  location: { lat: number | null; lng: number | null },
): Promise<void> {
  const { locationPolicy } = await getGeofencePolicy(organizationId);

  if (locationPolicy !== LocationPolicy.GEOFENCE_ENFORCED || employeeWorkModel !== "OFFICE") {
    return;
  }

  // GEO-04 — coordinates become mandatory (not optional) for in-scope
  // employees once enforcement is active; this is the one place Sprint 2
  // narrows Sprint 1's "always optional" attendance-location rule.
  if (location.lat === null || location.lng === null) {
    throw AppError.businessRule(
      "LOCATION_REQUIRED",
      "Location is required to check in under this organization's geofence policy",
    );
  }

  const zones = await prisma.geofenceZone.findMany({
    where: { organizationId, status: "ACTIVE" },
  });

  // GEO-06 — zones are OR'd: inside any one zone is sufficient. No active
  // zones configured means nothing can ever pass, by design (an org that
  // opts into enforcement without defining a zone yet should not silently
  // allow every check-in).
  const insideAnyZone = zones.some(
    (zone) =>
      haversineMeters({ lat: location.lat!, lng: location.lng! }, { lat: zone.lat, lng: zone.lng }) <=
      zone.radiusMeters,
  );

  if (!insideAnyZone) {
    throw AppError.businessRule(
      "OUTSIDE_GEOFENCE",
      "Check-in location is outside every configured geofence zone",
    );
  }
}
