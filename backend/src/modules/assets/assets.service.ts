import { AssetStatus, Prisma } from "@prisma/client";
import { prisma } from "@database/prisma";
import type { AuthContext } from "@common/auth/requireAuth";
import { AppError } from "@common/errors/AppError";
import { recordAudit } from "@modules/audit/audit.service";
import { getEmployeeByUserId } from "@modules/employees/employees.service";
import type {
  AssignAssetInput,
  CreateAssetInput,
  ListAssetsQuery,
  ReturnAssetInput,
  UpdateAssetInput,
} from "@modules/assets/assets.schema";

const ASSET_INCLUDE = {
  currentEmployee: {
    select: { id: true, employeeNo: true, user: { select: { email: true } } },
  },
} satisfies Prisma.AssetInclude;

// ASSET-06 — an Employee sees only their own currently-assigned assets,
// same "force-scope, ignore the caller's filter" pattern as
// expenses.service.ts's listExpenseClaims.
export async function listAssets(
  organizationId: string,
  requester: { userId: string; role: AuthContext["role"] },
  query: ListAssetsQuery,
) {
  const where: Prisma.AssetWhereInput = { organizationId };

  if (requester.role !== "HR_ADMIN" && requester.role !== "SUPER_ADMIN") {
    const employee = await getEmployeeByUserId(organizationId, requester.userId);
    where.currentEmployeeId = employee.id;
  } else if (query.employeeId) {
    where.currentEmployeeId = query.employeeId;
  }

  if (query.status) {
    where.status = query.status;
  }
  if (query.category) {
    where.category = query.category;
  }

  const [items, total] = await Promise.all([
    prisma.asset.findMany({
      where,
      include: ASSET_INCLUDE,
      orderBy: { createdAt: "desc" },
      skip: (query.page - 1) * query.pageSize,
      take: query.pageSize,
    }),
    prisma.asset.count({ where }),
  ]);

  return { items, meta: { page: query.page, pageSize: query.pageSize, total } };
}

// ASSET-02 — HR Admin/Super Admin only (enforced at the route level).
export async function createAsset(organizationId: string, input: CreateAssetInput, actorId: string) {
  try {
    return await prisma.$transaction(async (tx) => {
      const asset = await tx.asset.create({
        data: { organizationId, ...input },
        include: ASSET_INCLUDE,
      });

      await recordAudit(
        {
          organizationId,
          actorId,
          action: "ASSET_CREATED",
          resourceType: "Asset",
          resourceId: asset.id,
          metadata: { assetTag: input.assetTag, name: input.name },
        },
        tx,
      );

      return asset;
    });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      throw AppError.conflict(
        "ASSET_TAG_ALREADY_EXISTS",
        `An asset with tag "${input.assetTag}" already exists`,
      );
    }
    throw err;
  }
}

async function getOrgAsset(organizationId: string, assetId: string) {
  const asset = await prisma.asset.findFirst({ where: { id: assetId, organizationId } });
  if (!asset) {
    throw AppError.notFound("Asset");
  }
  return asset;
}

export async function updateAsset(
  organizationId: string,
  assetId: string,
  input: UpdateAssetInput,
  actorId: string,
) {
  const existing = await getOrgAsset(organizationId, assetId);

  // ASSET-03..05 — a direct PATCH must never move an asset into or out of
  // ASSIGNED; that transition only ever happens through assign()/
  // returnAsset() below, which keep currentEmployeeId and AssetAssignment
  // in sync with it.
  if (input.status && existing.status === AssetStatus.ASSIGNED) {
    throw AppError.conflict(
      "ASSET_CURRENTLY_ASSIGNED",
      "Return this asset before changing its status directly",
    );
  }

  return prisma.$transaction(async (tx) => {
    const updated = await tx.asset.update({
      where: { id: assetId },
      data: input,
      include: ASSET_INCLUDE,
    });

    await recordAudit(
      {
        organizationId,
        actorId,
        action: "ASSET_UPDATED",
        resourceType: "Asset",
        resourceId: assetId,
        metadata: input,
      },
      tx,
    );

    return updated;
  });
}

// ASSET-03/04 — fails if the asset isn't AVAILABLE (already assigned, in
// repair, or retired); "reassign" is return-then-assign, not a single step,
// so the previous holder's assignment always gets a clean returnedAt.
export async function assignAsset(
  organizationId: string,
  assetId: string,
  input: AssignAssetInput,
  actorId: string,
) {
  const existing = await getOrgAsset(organizationId, assetId);
  if (existing.status !== AssetStatus.AVAILABLE) {
    throw AppError.conflict(
      "ASSET_NOT_AVAILABLE",
      `Cannot assign an asset in status ${existing.status}`,
    );
  }

  const employee = await prisma.employee.findFirst({
    where: { id: input.employeeId, organizationId },
  });
  if (!employee) {
    throw AppError.badRequest("INVALID_EMPLOYEE", "employeeId must reference an employee in this organization");
  }

  return prisma.$transaction(async (tx) => {
    await tx.asset.update({
      where: { id: assetId },
      data: { status: AssetStatus.ASSIGNED, currentEmployeeId: input.employeeId },
    });

    await tx.assetAssignment.create({
      data: {
        assetId,
        employeeId: input.employeeId,
        assignedBy: actorId,
        notes: input.notes,
      },
    });

    await recordAudit(
      {
        organizationId,
        actorId,
        action: "ASSET_ASSIGNED",
        resourceType: "Asset",
        resourceId: assetId,
        metadata: { employeeId: input.employeeId },
      },
      tx,
    );

    return tx.asset.findUniqueOrThrow({ where: { id: assetId }, include: ASSET_INCLUDE });
  });
}

// ASSET-05 — closes the currently-open AssetAssignment row (there is
// exactly one at a time per ASSET-03/04's invariant) and frees the asset.
export async function returnAsset(
  organizationId: string,
  assetId: string,
  input: ReturnAssetInput,
  actorId: string,
) {
  const existing = await getOrgAsset(organizationId, assetId);
  if (existing.status !== AssetStatus.ASSIGNED) {
    throw AppError.conflict("ASSET_NOT_ASSIGNED", `Cannot return an asset in status ${existing.status}`);
  }

  return prisma.$transaction(async (tx) => {
    const openAssignment = await tx.assetAssignment.findFirstOrThrow({
      where: { assetId, returnedAt: null },
      orderBy: { assignedAt: "desc" },
    });

    await tx.assetAssignment.update({
      where: { id: openAssignment.id },
      data: {
        returnedAt: new Date(),
        returnedBy: actorId,
        notes: input.notes ?? openAssignment.notes,
      },
    });

    await tx.asset.update({
      where: { id: assetId },
      data: { status: AssetStatus.AVAILABLE, currentEmployeeId: null },
    });

    await recordAudit(
      {
        organizationId,
        actorId,
        action: "ASSET_RETURNED",
        resourceType: "Asset",
        resourceId: assetId,
        metadata: { employeeId: openAssignment.employeeId },
      },
      tx,
    );

    return tx.asset.findUniqueOrThrow({ where: { id: assetId }, include: ASSET_INCLUDE });
  });
}

export async function listAssetAssignments(organizationId: string, assetId: string) {
  await getOrgAsset(organizationId, assetId);
  return prisma.assetAssignment.findMany({
    where: { assetId },
    orderBy: { assignedAt: "desc" },
  });
}

// ASSET-08 — called from employees.service.ts's transitionEmployeeStatus
// (inside its own transaction) so a terminated employee's still-assigned
// assets can be flagged to HR. Read-only: this module never blocks a
// termination or auto-returns anything — return is always an explicit,
// separate HR action.
export async function countActiveAssignmentsForEmployee(
  tx: Prisma.TransactionClient,
  employeeId: string,
): Promise<number> {
  return tx.asset.count({ where: { currentEmployeeId: employeeId } });
}
