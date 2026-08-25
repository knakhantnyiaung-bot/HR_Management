import { Prisma } from "@prisma/client";
import { prisma } from "@database/prisma";
import { AppError } from "@common/errors/AppError";
import { recordAudit } from "@modules/audit/audit.service";
import type {
  CreateDepartmentInput,
  ListDepartmentsQuery,
  UpdateDepartmentInput,
} from "@modules/departments/departments.schema";

// DEPT-01 calls for "unique among active records," but the migrated schema
// enforces a simpler, stricter @@unique([organizationId, name]) across all
// statuses (a deactivated department's name can't be reused). Treated as an
// accepted MVP simplification rather than a partial-index migration.
const ALLOWED_STATUS_TRANSITIONS: Record<string, string[]> = {
  ACTIVE: ["INACTIVE"],
  INACTIVE: ["ACTIVE"],
};

function isNameConflict(err: unknown): boolean {
  return err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002";
}

export async function listDepartments(organizationId: string, query: ListDepartmentsQuery) {
  const where: Prisma.DepartmentWhereInput = {
    organizationId,
    ...(query.status ? { status: query.status } : {}),
  };

  const [items, total] = await Promise.all([
    prisma.department.findMany({
      where,
      orderBy: { name: "asc" },
      skip: (query.page - 1) * query.pageSize,
      take: query.pageSize,
    }),
    prisma.department.count({ where }),
  ]);

  return { items, meta: { page: query.page, pageSize: query.pageSize, total } };
}

export async function createDepartment(
  organizationId: string,
  input: CreateDepartmentInput,
  actorId: string,
) {
  try {
    return await prisma.$transaction(async (tx) => {
      const department = await tx.department.create({
        data: { organizationId, name: input.name },
      });

      await recordAudit(
        {
          organizationId,
          actorId,
          action: "DEPARTMENT_CREATED",
          resourceType: "Department",
          resourceId: department.id,
          metadata: { name: input.name },
        },
        tx,
      );

      return department;
    });
  } catch (err) {
    if (isNameConflict(err)) {
      throw AppError.conflict(
        "DEPARTMENT_NAME_TAKEN",
        `A department named "${input.name}" already exists in this organization`,
      );
    }
    throw err;
  }
}

export async function updateDepartment(
  organizationId: string,
  departmentId: string,
  input: UpdateDepartmentInput,
  actorId: string,
) {
  const existing = await prisma.department.findFirst({ where: { id: departmentId, organizationId } });
  if (!existing) {
    throw AppError.notFound("Department");
  }

  // No implicit same-status no-op: re-sending the current status (e.g. a
  // double deactivate) isn't in ALLOWED_STATUS_TRANSITIONS[current] either,
  // so it 409s here too — same strictness as payroll's double-approve guard.
  if (input.status && !ALLOWED_STATUS_TRANSITIONS[existing.status]?.includes(input.status)) {
    throw AppError.conflict(
      "INVALID_STATUS_TRANSITION",
      `Cannot transition department from ${existing.status} to ${input.status}`,
    );
  }

  try {
    return await prisma.$transaction(async (tx) => {
      const updated = await tx.department.update({ where: { id: departmentId }, data: input });

      await recordAudit(
        {
          organizationId,
          actorId,
          action: "DEPARTMENT_UPDATED",
          resourceType: "Department",
          resourceId: departmentId,
          metadata: input,
        },
        tx,
      );

      return updated;
    });
  } catch (err) {
    if (isNameConflict(err)) {
      throw AppError.conflict(
        "DEPARTMENT_NAME_TAKEN",
        `A department named "${input.name}" already exists in this organization`,
      );
    }
    throw err;
  }
}
