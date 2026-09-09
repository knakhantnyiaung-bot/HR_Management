import { Router } from "express";
import { requireAuth, requireRole } from "@common/auth/requireAuth";
import { asyncHandler } from "@common/middleware/asyncHandler";
import {
  completeCourseHandler,
  createCourseHandler,
  enrollAllActiveEmployeesHandler,
  enrollInCourseHandler,
  listCoursesHandler,
  listEnrollmentsHandler,
  updateCourseHandler,
} from "@modules/courses/courses.controller";

// Sprint 3 Wave 2, Handbook LMS-*. Catalog management (create/update,
// bulk-enroll) is HR Admin/Super Admin only; browsing/self-enroll/
// complete/list-own-enrollments is any authenticated employee.
export const coursesRouter = Router();

const HR_ROLES = ["HR_ADMIN", "SUPER_ADMIN"] as const;

coursesRouter.get("/", requireAuth, asyncHandler(listCoursesHandler));
coursesRouter.post("/", requireAuth, requireRole(...HR_ROLES), asyncHandler(createCourseHandler));
coursesRouter.patch("/:id", requireAuth, requireRole(...HR_ROLES), asyncHandler(updateCourseHandler));
coursesRouter.post("/:id/enroll", requireAuth, asyncHandler(enrollInCourseHandler));
coursesRouter.post(
  "/:id/enroll-all-active",
  requireAuth,
  requireRole(...HR_ROLES),
  asyncHandler(enrollAllActiveEmployeesHandler),
);
coursesRouter.post("/:id/complete", requireAuth, asyncHandler(completeCourseHandler));
coursesRouter.get("/enrollments", requireAuth, asyncHandler(listEnrollmentsHandler));
