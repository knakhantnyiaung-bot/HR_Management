import { apiClient, type ApiSuccess } from "@/lib/api/client";
import type { GeofenceZone, LocationPolicy } from "@/features/geofence/types";

export async function getGeofencePolicy(): Promise<{ locationPolicy: LocationPolicy }> {
  const res = await apiClient.get<ApiSuccess<{ locationPolicy: LocationPolicy }>>(
    "/organization/geofence-policy",
  );
  return res.data.data;
}

export async function updateGeofencePolicy(
  locationPolicy: LocationPolicy,
): Promise<{ locationPolicy: LocationPolicy }> {
  const res = await apiClient.patch<ApiSuccess<{ locationPolicy: LocationPolicy }>>(
    "/organization/geofence-policy",
    { locationPolicy },
  );
  return res.data.data;
}

export async function listGeofenceZones(): Promise<GeofenceZone[]> {
  const res = await apiClient.get<ApiSuccess<GeofenceZone[]>>("/organization/geofence-zones");
  return res.data.data;
}

export interface CreateGeofenceZoneInput {
  label: string;
  lat: number;
  lng: number;
  radiusMeters: number;
}

export async function createGeofenceZone(input: CreateGeofenceZoneInput): Promise<GeofenceZone> {
  const res = await apiClient.post<ApiSuccess<GeofenceZone>>("/organization/geofence-zones", input);
  return res.data.data;
}

export async function deactivateGeofenceZone(id: string): Promise<GeofenceZone> {
  const res = await apiClient.delete<ApiSuccess<GeofenceZone>>(`/organization/geofence-zones/${id}`);
  return res.data.data;
}
