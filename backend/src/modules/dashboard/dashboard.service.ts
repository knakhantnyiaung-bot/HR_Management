import { EmployeeStatus, Prisma, RequestStatus } from "@prisma/client";
import { prisma } from "@database/prisma";
import { getBusinessDate } from "@modules/attendance/attendance.service";
import { getEmployeeByUserId } from "@modules/employees/employees.service";
import { listLeaveBalances, listLeaveRequests } from "@modules/leave/leave.service";
import { listOvertimeRequests } from "@modules/overtime/overtime.service";
import { listPayslips } from "@modules/payslips/payslips.service";

// Handbook section 15.1: payroll is monthly, so "current" means the run for
// this calendar month — same YYYY-MM convention payroll.schema uses, not tied
// to organization timezone (payroll periods never have been either).
function currentPayrollPeriod(now: Date): string {
  const year = now.getUTCFullYear();
  const month = String(now.getUTCMonth() + 1).padStart(2, "0");
  return `${year}-${month}`;
}

function extractNetTotal(totals: Prisma.JsonValue | null | undefined): number | null {
  if (!totals || typeof totals !== "object" || Array.isArray(totals)) return null;
  const value = (totals as Record<string, unknown>).netTotal;
  return typeof value === "number" ? value : null;
}

// Handbook 15.1 HR Dashboard metrics.
export async function getHrDashboard(organizationId: string) {
  const now = new Date();
  const today = await getBusinessDate(organizationId, now);
  const period = currentPayrollPeriod(now);

  const [activeEmployees, presentToday, onLeave, pendingLeave, pendingOT, currentRun] =
    await Promise.all([
      prisma.employee.count({ where: { organizationId, status: EmployeeStatus.ACTIVE } }),
      prisma.attendanceRecord.findMany({
        where: { organizationId, workDate: today },
        distinct: ["employeeId"],
        select: { employeeId: true },
      }),
      prisma.leaveRequest.findMany({
        where: {
          status: RequestStatus.APPROVED,
          startDate: { lte: today },
          endDate: { gte: today },
          employee: { organizationId },
        },
        distinct: ["employeeId"],
        select: { employeeId: true },
      }),
      prisma.leaveRequest.count({
        where: { status: RequestStatus.PENDING, employee: { organizationId } },
      }),
      prisma.overtimeRequest.count({
        where: { status: RequestStatus.PENDING, employee: { organizationId } },
      }),
      prisma.payrollRun.findFirst({ where: { organizationId, period } }),
    ]);

  return {
    activeEmployees,
    presentToday: presentToday.length,
    onLeave: onLeave.length,
    pendingLeave,
    pendingOT,
    currentPayroll: { period, status: currentRun?.status ?? null },
    // "Clearly labeled gross or net aggregate" (15.1) — net, since that's
    // what an employee actually receives. `totals` is only populated once
    // CALCULATED, so this is naturally null for a DRAFT run or no run at all.
    payrollCost: { label: "net" as const, amount: extractNetTotal(currentRun?.totals) },
  };
}

// Handbook 15.2 Employee Dashboard — scoped to the caller's own Employee record.
export async function getEmployeeDashboard(organizationId: string, userId: string) {
  const employee = await getEmployeeByUserId(organizationId, userId);
  const today = await getBusinessDate(organizationId, new Date());

  const [todayAttendance, leaveBalances, pendingLeave, pendingOT, latestPayslips] = await Promise.all([
    prisma.attendanceRecord.findFirst({
      where: { employeeId: employee.id, workDate: today },
      orderBy: { checkIn: "desc" },
    }),
    listLeaveBalances(
      organizationId,
      { userId, role: "EMPLOYEE" },
      { period: String(today.getUTCFullYear()) },
    ),
    listLeaveRequests(
      organizationId,
      { userId, role: "EMPLOYEE" },
      { page: 1, pageSize: 1, status: RequestStatus.PENDING },
    ),
    listOvertimeRequests(
      organizationId,
      { userId, role: "EMPLOYEE" },
      { page: 1, pageSize: 1, status: RequestStatus.PENDING },
    ),
    listPayslips(organizationId, { userId, role: "EMPLOYEE" }, { page: 1, pageSize: 1 }),
  ]);

  return {
    attendanceToday: todayAttendance
      ? {
          checkIn: todayAttendance.checkIn,
          checkOut: todayAttendance.checkOut,
          workingMinutes: todayAttendance.workingMinutes,
        }
      : null,
    leaveBalances,
    pendingRequests: { leave: pendingLeave.meta.total, overtime: pendingOT.meta.total },
    latestPayslip: latestPayslips.items[0] ?? null,
  };
}
