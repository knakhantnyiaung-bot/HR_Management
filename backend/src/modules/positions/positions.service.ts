import type { Prisma } from "@prisma/client";
import { prisma } from "@database/prisma";
import { AppError } from "@common/errors/AppError";
import { recordAudit } from "@modules/audit/audit.service";
import type {
  CreatePositionInput,
  ListPositionsQuery,
  UpdatePositionInput,
} from "@modules/positions/positions.schema";

const ALLOWED_STATUS_TRANSITIONS: Record<string, string[]> = {
  ACTIVE: ["INACTIVE"],
  INACTIVE: ["ACTIVE"],
};

// POS-01: position belongs to organization; department existence isn't
// restricted to ACTIVE here, matching employees.service's
// assertDepartmentAndPosition, which has no such restriction either.
async function assertDepartmentInOrg(organizationId: string, departmentId: string): Promise<void> {
  const department = await prisma.department.findFirst({ where: { id: departmentId, organizationId } });
  if (!department) {
    throw AppError.badRequest("INVALID_DEPARTMENT", "Department not found in this organization");
  }
}

export async function listPositions(organizationId: string, query: ListPositionsQuery) {
  const where: Prisma.PositionWhereInput = {
    organizationId,
    ...(query.departmentId ? { departmentId: query.departmentId } : {}),
    ...(query.status ? { status: query.status } : {}),
  };

  const [items, total] = await Promise.all([
    prisma.position.findMany({
      where,
      orderBy: { title: "asc" },
      skip: (query.page - 1) * query.pageSize,
      take: query.pageSize,
    }),
    prisma.position.count({ where }),
  ]);

  return { items, meta: { page: query.page, pageSize: query.pageSize, total } };
}

export async function createPosition(
  organizationId: string,
  input: CreatePositionInput,
  actorId: string,
) {
  await assertDepartmentInOrg(organizationId, input.departmentId);

  return prisma.$transaction(async (tx) => {
    const position = await tx.position.create({
      data: { organizationId, departmentId: input.departmentId, title: input.title },
    });

    await recordAudit(
      {
        organizationId,
        actorId,
        action: "POSITION_CREATED",
        resourceType: "Position",
        resourceId: position.id,
        metadata: { title: input.title, departmentId: input.departmentId },
      },
      tx,
    );

    return position;
  });
}

export async function updatePosition(
  organizationId: string,
  positionId: string,
  input: UpdatePositionInput,
  actorId: string,
) {
  const existing = await prisma.position.findFirst({ where: { id: positionId, organizationId } });
  if (!existing) {
    throw AppError.notFound("Position");
  }

  if (input.departmentId) {
    await assertDepartmentInOrg(organizationId, input.departmentId);
  }

  // No implicit same-status no-op — see departments.service's identical guard.
  if (input.status && !ALLOWED_STATUS_TRANSITIONS[existing.status]?.includes(input.status)) {
    throw AppError.conflict(
      "INVALID_STATUS_TRANSITION",
      `Cannot transition position from ${existing.status} to ${input.status}`,
    );
  }

  return prisma.$transaction(async (tx) => {
    const updated = await tx.position.update({ where: { id: positionId }, data: input });

    await recordAudit(
      {
        organizationId,
        actorId,
        action: "POSITION_UPDATED",
        resourceType: "Position",
        resourceId: positionId,
        metadata: input,
      },
      tx,
    );

    return updated;
  });
}
