export type LocationPolicy = "NONE" | "LOG_ONLY" | "GEOFENCE_ENFORCED";

export interface GeofenceZone {
  id: string;
  label: string;
  lat: number;
  lng: number;
  radiusMeters: number;
  status: "ACTIVE" | "INACTIVE";
}
