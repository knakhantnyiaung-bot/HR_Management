import { randomBytes } from "node:crypto";
import bcrypt from "bcrypt";
import { EmployeeStatus, Prisma } from "@prisma/client";
import { prisma } from "@database/prisma";
import { AppError } from "@common/errors/AppError";
import { recordAudit } from "@modules/audit/audit.service";
import type {
  CreateEmployeeInput,
  ListEmployeesQuery,
  UpdateEmployeeInput,
} from "@modules/employees/employees.schema";

const EMPLOYEE_INCLUDE = {
  department: { select: { id: true, name: true } },
  position: { select: { id: true, title: true } },
  user: { select: { id: true, email: true, role: true, status: true } },
} satisfies Prisma.EmployeeInclude;

type EmployeeWithRelations = Prisma.EmployeeGetPayload<{ include: typeof EMPLOYEE_INCLUDE }>;

// HLD Appendix C — Employee state machine: DRAFT -> ACTIVE -> INACTIVE / TERMINATED
const ALLOWED_TRANSITIONS: Record<EmployeeStatus, EmployeeStatus[]> = {
  DRAFT: [EmployeeStatus.ACTIVE],
  ACTIVE: [EmployeeStatus.INACTIVE, EmployeeStatus.TERMINATED],
  INACTIVE: [EmployeeStatus.ACTIVE, EmployeeStatus.TERMINATED],
  TERMINATED: [],
};

function generateTempPassword(): string {
  return randomBytes(9).toString("base64url");
}

function isUniqueConstraintOn(err: unknown, fieldHint: string): boolean {
  return (
    err instanceof Prisma.PrismaClientKnownRequestError &&
    err.code === "P2002" &&
    Array.isArray(err.meta?.target) &&
    (err.meta!.target as string[]).some((t) => t.includes(fieldHint))
  );
}

async function assertDepartmentAndPosition(
  organizationId: string,
  departmentId: string,
  positionId: string,
): Promise<void> {
  const [department, position] = await Promise.all([
    prisma.department.findFirst({ where: { id: departmentId, organizationId } }),
    prisma.position.findFirst({ where: { id: positionId, organizationId, departmentId } }),
  ]);

  if (!department) {
    throw AppError.badRequest("INVALID_DEPARTMENT", "Department not found in this organization");
  }
  if (!position) {
    throw AppError.badRequest(
      "INVALID_POSITION",
      "Position not found in this organization/department",
    );
  }
}

export async function listEmployees(organizationId: string, query: ListEmployeesQuery) {
  const where: Prisma.EmployeeWhereInput = {
    organizationId,
    ...(query.departmentId ? { departmentId: query.departmentId } : {}),
    ...(query.status ? { status: query.status } : {}),
  };

  const [items, total] = await Promise.all([
    prisma.employee.findMany({
      where,
      include: EMPLOYEE_INCLUDE,
      orderBy: { createdAt: "desc" },
      skip: (query.page - 1) * query.pageSize,
      take: query.pageSize,
    }),
    prisma.employee.count({ where }),
  ]);

  return { items, meta: { page: query.page, pageSize: query.pageSize, total } };
}

export async function getEmployeeById(
  organizationId: string,
  employeeId: string,
): Promise<EmployeeWithRelations> {
  const employee = await prisma.employee.findFirst({
    where: { id: employeeId, organizationId },
    include: EMPLOYEE_INCLUDE,
  });

  if (!employee) {
    throw AppError.notFound("Employee");
  }

  return employee;
}

export async function createEmployee(
  organizationId: string,
  input: CreateEmployeeInput,
  actorId: string,
): Promise<{ employee: EmployeeWithRelations; temporaryPassword?: string }> {
  await assertDepartmentAndPosition(organizationId, input.departmentId, input.positionId);

  const temporaryPassword = input.password ? undefined : generateTempPassword();
  const passwordHash = await bcrypt.hash(input.password ?? temporaryPassword!, 10);

  const MAX_ATTEMPTS = 3;
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      const employee = await prisma.$transaction(async (tx) => {
        const employeeNo =
          input.employeeNo ?? `EMP-${String((await tx.employee.count({ where: { organizationId } })) + 1).padStart(4, "0")}`;

        const user = await tx.user.create({
          data: { organizationId, email: input.email, passwordHash, role: "EMPLOYEE" },
        });

        const created = await tx.employee.create({
          data: {
            organizationId,
            userId: user.id,
            employeeNo,
            joinDate: input.joinDate,
            departmentId: input.departmentId,
            positionId: input.positionId,
            workModel: input.workModel,
            status: EmployeeStatus.DRAFT,
          },
          include: EMPLOYEE_INCLUDE,
        });

        await recordAudit(
          {
            organizationId,
            actorId,
            action: "EMPLOYEE_CREATED",
            resourceType: "Employee",
            resourceId: created.id,
            metadata: { employeeNo, email: input.email },
          },
          tx,
        );

        return created;
      });

      return { employee, temporaryPassword };
    } catch (err) {
      if (isUniqueConstraintOn(err, "email")) {
        throw AppError.conflict(
          "EMAIL_ALREADY_EXISTS",
          "A user with this email already exists in the organization",
        );
      }
      if (isUniqueConstraintOn(err, "employee_no")) {
        if (input.employeeNo || attempt === MAX_ATTEMPTS) {
          throw AppError.conflict("EMPLOYEE_NO_TAKEN", "Employee number is already in use");
        }
        continue; // regenerate employeeNo from a fresh count and retry
      }
      throw err;
    }
  }

  throw AppError.conflict(
    "EMPLOYEE_NO_GENERATION_FAILED",
    "Could not generate a unique employee number, please retry",
  );
}

export async function updateEmployee(
  organizationId: string,
  employeeId: string,
  input: UpdateEmployeeInput,
  actorId: string,
): Promise<EmployeeWithRelations> {
  const existing = await prisma.employee.findFirst({ where: { id: employeeId, organizationId } });
  if (!existing) {
    throw AppError.notFound("Employee");
  }

  if (input.departmentId || input.positionId) {
    await assertDepartmentAndPosition(
      organizationId,
      input.departmentId ?? existing.departmentId,
      input.positionId ?? existing.positionId,
    );
  }

  return prisma.$transaction(async (tx) => {
    const updated = await tx.employee.update({
      where: { id: employeeId },
      data: input,
      include: EMPLOYEE_INCLUDE,
    });

    await recordAudit(
      {
        organizationId,
        actorId,
        action: "EMPLOYEE_UPDATED",
        resourceType: "Employee",
        resourceId: employeeId,
        metadata: input as Prisma.InputJsonValue,
      },
      tx,
    );

    return updated;
  });
}

async function transitionEmployeeStatus(
  organizationId: string,
  employeeId: string,
  target: EmployeeStatus,
  actorId: string,
  action: string,
): Promise<EmployeeWithRelations> {
  return prisma.$transaction(async (tx) => {
    const employee = await tx.employee.findFirst({ where: { id: employeeId, organizationId } });
    if (!employee) {
      throw AppError.notFound("Employee");
    }

    if (!ALLOWED_TRANSITIONS[employee.status].includes(target)) {
      throw AppError.conflict(
        "INVALID_STATUS_TRANSITION",
        `Cannot transition employee from ${employee.status} to ${target}`,
      );
    }

    // Deactivating/terminating an employee also locks their login. This must
    // run before the include'd read below, or the response's nested `user`
    // reflects the pre-update status even though the DB itself is correct.
    await tx.user.update({
      where: { id: employee.userId },
      data: { status: target === EmployeeStatus.ACTIVE ? "ACTIVE" : "INACTIVE" },
    });

    const updated = await tx.employee.update({
      where: { id: employeeId },
      data: { status: target },
      include: EMPLOYEE_INCLUDE,
    });

    await recordAudit(
      {
        organizationId,
        actorId,
        action,
        resourceType: "Employee",
        resourceId: employeeId,
        metadata: { from: employee.status, to: target },
      },
      tx,
    );

    return updated;
  });
}

export const activateEmployee = (organizationId: string, employeeId: string, actorId: string) =>
  transitionEmployeeStatus(
    organizationId,
    employeeId,
    EmployeeStatus.ACTIVE,
    actorId,
    "EMPLOYEE_ACTIVATED",
  );

export const deactivateEmployee = (organizationId: string, employeeId: string, actorId: string) =>
  transitionEmployeeStatus(
    organizationId,
    employeeId,
    EmployeeStatus.INACTIVE,
    actorId,
    "EMPLOYEE_DEACTIVATED",
  );

export const terminateEmployee = (organizationId: string, employeeId: string, actorId: string) =>
  transitionEmployeeStatus(
    organizationId,
    employeeId,
    EmployeeStatus.TERMINATED,
    actorId,
    "EMPLOYEE_TERMINATED",
  );
