import { apiClient, type ApiSuccess } from "@/lib/api/client";
import type { ListResult } from "@/lib/api/types";
import type { Course, CourseEnrollment, CourseStatus } from "@/features/courses/types";

export interface ListCoursesParams {
  page: number;
  pageSize: number;
  status?: CourseStatus;
  category?: string;
}

export async function listCourses(params: ListCoursesParams): Promise<ListResult<Course>> {
  const res = await apiClient.get<ApiSuccess<Course[]>>("/courses", { params });
  return { items: res.data.data, meta: res.data.meta! };
}

export interface CreateCourseInput {
  title: string;
  description?: string;
  externalUrl: string;
  category?: string;
  mandatory?: boolean;
}

export async function createCourse(input: CreateCourseInput): Promise<Course> {
  const res = await apiClient.post<ApiSuccess<Course>>("/courses", input);
  return res.data.data;
}

export interface UpdateCourseInput {
  title?: string;
  description?: string;
  externalUrl?: string;
  category?: string;
  mandatory?: boolean;
  status?: CourseStatus;
}

export async function updateCourse(id: string, input: UpdateCourseInput): Promise<Course> {
  const res = await apiClient.patch<ApiSuccess<Course>>(`/courses/${id}`, input);
  return res.data.data;
}

export async function enrollInCourse(id: string): Promise<CourseEnrollment> {
  const res = await apiClient.post<ApiSuccess<CourseEnrollment>>(`/courses/${id}/enroll`);
  return res.data.data;
}

export async function enrollAllActiveEmployees(id: string): Promise<{ newlyEnrolled: number }> {
  const res = await apiClient.post<ApiSuccess<{ newlyEnrolled: number }>>(
    `/courses/${id}/enroll-all-active`,
  );
  return res.data.data;
}

export async function completeCourse(id: string): Promise<CourseEnrollment> {
  const res = await apiClient.post<ApiSuccess<CourseEnrollment>>(`/courses/${id}/complete`);
  return res.data.data;
}

export interface ListEnrollmentsParams {
  page: number;
  pageSize: number;
  courseId?: string;
}

export async function listEnrollments(params: ListEnrollmentsParams): Promise<ListResult<CourseEnrollment>> {
  const res = await apiClient.get<ApiSuccess<CourseEnrollment[]>>("/courses/enrollments", { params });
  return { items: res.data.data, meta: res.data.meta! };
}
