export type ReviewCycleStatus = "DRAFT" | "OPEN" | "CLOSED";
export type ReviewStatus = "PENDING" | "SELF_SUBMITTED" | "COMPLETED";

export interface ReviewCycle {
  id: string;
  name: string;
  periodStart: string;
  periodEnd: string;
  status: ReviewCycleStatus;
}

export interface PerformanceReview {
  id: string;
  cycleId: string;
  employeeId: string;
  goals: string | null;
  selfRating: number | null;
  selfComments: string | null;
  selfSubmittedAt: string | null;
  managerRating: number | null;
  managerComments: string | null;
  managerSubmittedAt: string | null;
  status: ReviewStatus;
  cycle: { id: string; name: string; status: ReviewCycleStatus; periodStart: string; periodEnd: string };
  employee: { id: string; employeeNo: string; managerId: string | null; user: { email: string } };
}
