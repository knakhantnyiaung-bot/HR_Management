export type CourseStatus = "ACTIVE" | "ARCHIVED";

export interface Course {
  id: string;
  title: string;
  description: string | null;
  externalUrl: string;
  category: string | null;
  mandatory: boolean;
  status: CourseStatus;
  createdAt: string;
}

export interface CourseEnrollment {
  id: string;
  courseId: string;
  employeeId: string;
  enrolledAt: string;
  completedAt: string | null;
  course: { id: string; title: string; externalUrl: string; mandatory: boolean };
  employee: { id: string; employeeNo: string; user: { email: string } };
}
