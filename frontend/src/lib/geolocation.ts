// HLD v1.1 §15 / Handbook v1.1 §9.3 — request location only at the moment of
// the check-in/check-out action (never on page load), with a short timeout,
// and resolve to `undefined` rather than throwing on denial/timeout/error so
// the action never blocks on a permission prompt or missing GPS.
export interface CapturedLocation {
  lat: number;
  lng: number;
  accuracyMeters: number;
}

const TIMEOUT_MS = 6000;

export function captureLocation(): Promise<CapturedLocation | undefined> {
  return new Promise((resolve) => {
    if (!("geolocation" in navigator)) {
      resolve(undefined);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        resolve({
          lat: position.coords.latitude,
          lng: position.coords.longitude,
          accuracyMeters: position.coords.accuracy,
        });
      },
      () => resolve(undefined),
      { timeout: TIMEOUT_MS, maximumAge: 0 },
    );
  });
}
