export type LocationPolicy = "NONE" | "LOG_ONLY" | "GEOFENCE_ENFORCED";

export type GeofenceShape = "CIRCLE" | "POLYGON";

export interface GeofencePoint {
  lat: number;
  lng: number;
}

export interface GeofenceZone {
  id: string;
  label: string;
  shape: GeofenceShape;
  lat: number | null;
  lng: number | null;
  radiusMeters: number | null;
  polygon: GeofencePoint[] | null;
  status: "ACTIVE" | "INACTIVE";
}
