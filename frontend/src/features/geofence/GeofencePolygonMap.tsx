import { useCallback } from "react";
import { CircleMarker, MapContainer, Polygon, TileLayer, useMapEvents } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import type { GeofencePoint } from "@/features/geofence/types";

// Yangon-ish default — matches Organization.timezone's default (Asia/Yangon)
// so a fresh map centers somewhere plausible before the admin has drawn
// anything; it has no bearing on the zone itself.
const DEFAULT_CENTER: GeofencePoint = { lat: 16.8, lng: 96.15 };

interface GeofencePolygonMapProps {
  points: GeofencePoint[];
  onChange: (points: GeofencePoint[]) => void;
}

function ClickToAddVertex({ onAdd }: { onAdd: (point: GeofencePoint) => void }) {
  useMapEvents({
    click(e) {
      onAdd({ lat: e.latlng.lat, lng: e.latlng.lng });
    },
  });
  return null;
}

// GEO-10/Handbook §4 — HR Admin draws a polygon zone by clicking vertices
// directly on an OpenStreetMap tile layer (no API key/vendor account
// needed). Vertices are appended in click order, which is also the order
// the backend expects them in.
export function GeofencePolygonMap({ points, onChange }: GeofencePolygonMapProps) {
  const handleAdd = useCallback((point: GeofencePoint) => onChange([...points, point]), [points, onChange]);
  const handleRemoveLast = () => onChange(points.slice(0, -1));
  const handleClear = () => onChange([]);
  const center = points[0] ?? DEFAULT_CENTER;

  return (
    <div className="space-y-2">
      <div className="h-64 w-full overflow-hidden rounded-md border border-slate-200 dark:border-slate-800">
        <MapContainer center={[center.lat, center.lng]} zoom={16} style={{ height: "100%", width: "100%" }}>
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          <ClickToAddVertex onAdd={handleAdd} />
          {points.map((point, index) => (
            <CircleMarker
              key={index}
              center={[point.lat, point.lng]}
              radius={5}
              pathOptions={{ color: "#2563eb" }}
            />
          ))}
          {points.length >= 3 && (
            <Polygon positions={points.map((p) => [p.lat, p.lng])} pathOptions={{ color: "#2563eb" }} />
          )}
        </MapContainer>
      </div>
      <div className="flex items-center justify-between text-sm text-slate-500 dark:text-slate-400">
        <span>
          {points.length} point{points.length === 1 ? "" : "s"} — click the map to add a vertex (3-50 required)
        </span>
        <div className="flex gap-3">
          <button type="button" onClick={handleRemoveLast} disabled={points.length === 0} className="btn-text">
            Remove last
          </button>
          <button type="button" onClick={handleClear} disabled={points.length === 0} className="btn-text">
            Clear
          </button>
        </div>
      </div>
    </div>
  );
}
