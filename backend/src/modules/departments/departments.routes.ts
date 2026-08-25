import { Router } from "express";
import { requireAuth, requireRole } from "@common/auth/requireAuth";
import { asyncHandler } from "@common/middleware/asyncHandler";
import {
  createDepartmentHandler,
  listDepartmentsHandler,
  updateDepartmentHandler,
} from "@modules/departments/departments.controller";

// HLD section 7 (DEPT-01/MASTER-01) + permission matrix: Super Admin/HR Admin
// R/W, Employee R only. Deactivation goes through PATCH's `status` field (no
// separate route was scaffolded) — the service guards it as an explicit
// ACTIVE<->INACTIVE transition, not an arbitrary field write.
export const departmentsRouter = Router();

const HR_ROLES = ["HR_ADMIN", "SUPER_ADMIN"] as const;

departmentsRouter.get("/", requireAuth, asyncHandler(listDepartmentsHandler));
departmentsRouter.post(
  "/",
  requireAuth,
  requireRole(...HR_ROLES),
  asyncHandler(createDepartmentHandler),
);
departmentsRouter.patch(
  "/:id",
  requireAuth,
  requireRole(...HR_ROLES),
  asyncHandler(updateDepartmentHandler),
);
