export type LocationSource = "GPS" | "MANUAL" | "UNAVAILABLE";

export interface AttendanceRecord {
  id: string;
  employeeId: string;
  workDate: string;
  checkIn: string;
  checkOut: string | null;
  workingMinutes: number | null;
  correctedBy: string | null;
  correctionNote: string | null;
  checkInLat: number | null;
  checkInLng: number | null;
  checkInAccuracyM: number | null;
  checkOutLat: number | null;
  checkOutLng: number | null;
  checkOutAccuracyM: number | null;
  locationSource: LocationSource;
  employee: { id: string; employeeNo: string; user: { email: string } };
}
