import type { Prisma } from "@prisma/client";
import { prisma } from "@database/prisma";
import { AppError } from "@common/errors/AppError";
import { getEmployeeByUserId } from "@modules/employees/employees.service";
import type { ListPayslipsQuery } from "@modules/payslips/payslips.schema";

export interface PayslipRequester {
  userId: string;
  role: "SUPER_ADMIN" | "HR_ADMIN" | "EMPLOYEE";
}

const PAYSLIP_INCLUDE = {
  payrollItem: {
    include: {
      employee: { select: { id: true, employeeNo: true, user: { select: { email: true } } } },
      payrollRun: { select: { id: true, period: true, status: true } },
    },
  },
} satisfies Prisma.PayslipInclude;

// Payslip has no organizationId/employeeId of its own (Appendix A: "id,
// payroll_item_id, released_at, document reference") — every scope check
// goes through the owning PayrollItem's employee.
async function buildScopedPayrollItemWhere(
  organizationId: string,
  requester: PayslipRequester,
  employeeIdFilter: string | undefined,
): Promise<Prisma.PayrollItemWhereInput> {
  const where: Prisma.PayrollItemWhereInput = { employee: { organizationId } };

  if (requester.role === "EMPLOYEE") {
    const employee = await getEmployeeByUserId(organizationId, requester.userId);
    where.employeeId = employee.id;
  } else if (employeeIdFilter) {
    where.employeeId = employeeIdFilter;
  }

  return where;
}

export async function listPayslips(
  organizationId: string,
  requester: PayslipRequester,
  query: ListPayslipsQuery,
) {
  const payrollItemWhere = await buildScopedPayrollItemWhere(organizationId, requester, query.employeeId);
  if (query.period) {
    payrollItemWhere.payrollRun = { period: query.period };
  }

  const where: Prisma.PayslipWhereInput = { payrollItem: payrollItemWhere };

  const [items, total] = await Promise.all([
    prisma.payslip.findMany({
      where,
      include: PAYSLIP_INCLUDE,
      orderBy: { releasedAt: "desc" },
      skip: (query.page - 1) * query.pageSize,
      take: query.pageSize,
    }),
    prisma.payslip.count({ where }),
  ]);

  return { items, meta: { page: query.page, pageSize: query.pageSize, total } };
}

// HLD section 23 security test: "Employee cannot access another employee's
// payslip." A mismatch is reported as 404 rather than 403 so an Employee
// probing another employee's payslip id can't even confirm it exists.
export async function getPayslipById(organizationId: string, requester: PayslipRequester, payslipId: string) {
  const payrollItemWhere = await buildScopedPayrollItemWhere(organizationId, requester, undefined);

  const payslip = await prisma.payslip.findFirst({
    where: { id: payslipId, payrollItem: payrollItemWhere },
    include: PAYSLIP_INCLUDE,
  });
  if (!payslip) {
    throw AppError.notFound("Payslip");
  }

  return payslip;
}
