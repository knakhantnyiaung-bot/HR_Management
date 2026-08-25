import { Router } from "express";
import { requireAuth, requireRole } from "@common/auth/requireAuth";
import { asyncHandler } from "@common/middleware/asyncHandler";
import {
  createPositionHandler,
  listPositionsHandler,
  updatePositionHandler,
} from "@modules/positions/positions.controller";

// HLD section 7 (POS-01/MASTER-01) + permission matrix: Super Admin/HR Admin
// R/W, Employee R only. Deactivation goes through PATCH's `status` field (no
// separate route was scaffolded), same convention as departments.
export const positionsRouter = Router();

const HR_ROLES = ["HR_ADMIN", "SUPER_ADMIN"] as const;

positionsRouter.get("/", requireAuth, asyncHandler(listPositionsHandler));
positionsRouter.post("/", requireAuth, requireRole(...HR_ROLES), asyncHandler(createPositionHandler));
positionsRouter.patch(
  "/:id",
  requireAuth,
  requireRole(...HR_ROLES),
  asyncHandler(updatePositionHandler),
);
