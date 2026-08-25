export interface AttendanceRecord {
  id: string;
  employeeId: string;
  workDate: string;
  checkIn: string;
  checkOut: string | null;
  workingMinutes: number | null;
  correctedBy: string | null;
  correctionNote: string | null;
  employee: { id: string; employeeNo: string; user: { email: string } };
}
