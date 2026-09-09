import type { Request, Response } from "express";
import { requireAuthContext, requireIdParam } from "@common/http/requestHelpers";
import {
  createCourseSchema,
  listCoursesQuerySchema,
  listEnrollmentsQuerySchema,
  updateCourseSchema,
} from "@modules/courses/courses.schema";
import {
  completeCourse,
  createCourse,
  enrollAllActiveEmployees,
  enrollInCourse,
  listCourses,
  listEnrollments,
  updateCourse,
} from "@modules/courses/courses.service";

export async function listCoursesHandler(req: Request, res: Response): Promise<void> {
  const { organizationId } = requireAuthContext(req);
  const query = listCoursesQuerySchema.parse(req.query);
  const result = await listCourses(organizationId, query);
  res.json({ success: true, data: result.items, meta: result.meta });
}

export async function createCourseHandler(req: Request, res: Response): Promise<void> {
  const { organizationId, userId } = requireAuthContext(req);
  const input = createCourseSchema.parse(req.body);
  const course = await createCourse(organizationId, input, userId);
  res.status(201).json({ success: true, data: course });
}

export async function updateCourseHandler(req: Request, res: Response): Promise<void> {
  const { organizationId, userId } = requireAuthContext(req);
  const input = updateCourseSchema.parse(req.body);
  const course = await updateCourse(organizationId, requireIdParam(req), input, userId);
  res.json({ success: true, data: course });
}

export async function enrollInCourseHandler(req: Request, res: Response): Promise<void> {
  const { organizationId, userId } = requireAuthContext(req);
  const enrollment = await enrollInCourse(organizationId, requireIdParam(req), userId);
  res.status(201).json({ success: true, data: enrollment });
}

export async function enrollAllActiveEmployeesHandler(req: Request, res: Response): Promise<void> {
  const { organizationId, userId } = requireAuthContext(req);
  const result = await enrollAllActiveEmployees(organizationId, requireIdParam(req), userId);
  res.json({ success: true, data: result });
}

export async function completeCourseHandler(req: Request, res: Response): Promise<void> {
  const { organizationId, userId } = requireAuthContext(req);
  const enrollment = await completeCourse(organizationId, requireIdParam(req), userId);
  res.json({ success: true, data: enrollment });
}

export async function listEnrollmentsHandler(req: Request, res: Response): Promise<void> {
  const { organizationId, userId, role } = requireAuthContext(req);
  const query = listEnrollmentsQuerySchema.parse(req.query);
  const result = await listEnrollments(organizationId, { userId, role }, query);
  res.json({ success: true, data: result.items, meta: result.meta });
}
