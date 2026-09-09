import { Router } from "express";
import { requireAuth, requireRole } from "@common/auth/requireAuth";
import { asyncHandler } from "@common/middleware/asyncHandler";
import {
  assignAssetHandler,
  createAssetHandler,
  listAssetAssignmentsHandler,
  listAssetsHandler,
  returnAssetHandler,
  updateAssetHandler,
} from "@modules/assets/assets.controller";

// Sprint 3 Wave 2, Handbook ASSET-*. HR Admin/Super Admin manage the
// register and assign/return; an Employee may only list (their own
// currently-assigned assets — scoped in assets.service.ts, same pattern as
// expenses).
export const assetsRouter = Router();

const HR_ROLES = ["HR_ADMIN", "SUPER_ADMIN"] as const;

assetsRouter.get("/", requireAuth, asyncHandler(listAssetsHandler));
assetsRouter.post("/", requireAuth, requireRole(...HR_ROLES), asyncHandler(createAssetHandler));
assetsRouter.patch("/:id", requireAuth, requireRole(...HR_ROLES), asyncHandler(updateAssetHandler));
assetsRouter.post(
  "/:id/assign",
  requireAuth,
  requireRole(...HR_ROLES),
  asyncHandler(assignAssetHandler),
);
assetsRouter.post(
  "/:id/return",
  requireAuth,
  requireRole(...HR_ROLES),
  asyncHandler(returnAssetHandler),
);
assetsRouter.get(
  "/:id/assignments",
  requireAuth,
  requireRole(...HR_ROLES),
  asyncHandler(listAssetAssignmentsHandler),
);
