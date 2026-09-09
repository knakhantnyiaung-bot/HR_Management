import { AssetCategory, AssetStatus } from "@prisma/client";
import { z } from "zod";

export const createAssetSchema = z.object({
  assetTag: z.string().min(1),
  name: z.string().min(1),
  category: z.nativeEnum(AssetCategory).default(AssetCategory.OTHER),
  serialNumber: z.string().optional(),
  notes: z.string().optional(),
});

export type CreateAssetInput = z.infer<typeof createAssetSchema>;

// ASSET-03..05 — status here is deliberately restricted to the three
// values reachable outside the assign/return actions; ASSIGNED is never
// settable directly (it would desync from currentEmployeeId/
// AssetAssignment). See assets.service.ts.
const directlySettableStatus = z.enum(["AVAILABLE", "IN_REPAIR", "RETIRED"]);

export const updateAssetSchema = z
  .object({
    name: z.string().min(1).optional(),
    category: z.nativeEnum(AssetCategory).optional(),
    serialNumber: z.string().optional(),
    notes: z.string().optional(),
    status: directlySettableStatus.optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: "At least one field must be provided",
  });

export type UpdateAssetInput = z.infer<typeof updateAssetSchema>;

export const assignAssetSchema = z.object({
  employeeId: z.string().uuid(),
  notes: z.string().optional(),
});

export type AssignAssetInput = z.infer<typeof assignAssetSchema>;

export const returnAssetSchema = z.object({
  notes: z.string().optional(),
});

export type ReturnAssetInput = z.infer<typeof returnAssetSchema>;

export const listAssetsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  status: z.nativeEnum(AssetStatus).optional(),
  category: z.nativeEnum(AssetCategory).optional(),
  // HR/Super Admin only (EMPLOYEE requesters are always scoped to their own
  // employeeId regardless of this filter — enforced in assets.service.ts).
  employeeId: z.string().uuid().optional(),
});

export type ListAssetsQuery = z.infer<typeof listAssetsQuerySchema>;
