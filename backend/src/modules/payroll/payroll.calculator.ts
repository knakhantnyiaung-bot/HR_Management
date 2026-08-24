// Pure payroll domain calculation — no Prisma/Express imports on purpose.
// HLD section 13: "Treat calculation as a deterministic domain service."
// HLD section 23 Testing Architecture calls out "payroll formulas" as
// needing dedicated unit tests; this module's purity is what makes that
// possible without a database.

export interface OvertimeInput {
  id: string;
  hours: number;
  multiplier: number;
}

export interface UnpaidLeaveInput {
  id: string;
  days: number;
}

export interface SalaryProfileInput {
  id: string;
  basicSalary: number;
  allowances: Record<string, number>;
  deductions: Record<string, number>;
  standardMonthlyHours?: number;
  standardWorkingDays?: number;
}

export interface CalculatePayrollItemInput {
  salaryProfile: SalaryProfileInput;
  approvedOvertime: OvertimeInput[];
  unpaidLeave: UnpaidLeaveInput[];
}

export interface CalculatePayrollItemResult {
  earnings: number;
  deductions: number;
  gross: number;
  net: number;
  snapshotInput: Record<string, unknown>;
}

// The HLD specifies the calculation model (Gross = Basic + Allowances + OT +
// Bonus; Net = Gross - Deductions - Unpaid Leave - Other) but leaves the
// OT/unpaid-leave rate *basis* unspecified beyond "OT settings" on the
// salary profile. These are the MVP defaults, overridable per employee via
// SalaryProfile.otSettings — documented here since there's no other spec to
// point to.
export const DEFAULT_STANDARD_MONTHLY_HOURS = 208; // 26 working days x 8 hours
export const DEFAULT_STANDARD_WORKING_DAYS = 26;

function round2(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function sumAmounts(values: Record<string, number>): number {
  return Object.values(values).reduce((sum, v) => sum + (Number.isFinite(v) ? v : 0), 0);
}

export function calculatePayrollItem(input: CalculatePayrollItemInput): CalculatePayrollItemResult {
  const { salaryProfile, approvedOvertime, unpaidLeave } = input;

  const standardMonthlyHours = salaryProfile.standardMonthlyHours ?? DEFAULT_STANDARD_MONTHLY_HOURS;
  const standardWorkingDays = salaryProfile.standardWorkingDays ?? DEFAULT_STANDARD_WORKING_DAYS;
  const hourlyRate = salaryProfile.basicSalary / standardMonthlyHours;
  const dailyRate = salaryProfile.basicSalary / standardWorkingDays;

  const fixedAllowances = sumAmounts(salaryProfile.allowances);
  const fixedDeductions = sumAmounts(salaryProfile.deductions);

  const overtimeBreakdown = approvedOvertime.map((ot) => ({
    id: ot.id,
    hours: ot.hours,
    multiplier: ot.multiplier,
    amount: round2(hourlyRate * ot.hours * ot.multiplier),
  }));
  const approvedOvertimePay = round2(overtimeBreakdown.reduce((sum, ot) => sum + ot.amount, 0));

  const leaveBreakdown = unpaidLeave.map((leave) => ({
    id: leave.id,
    days: leave.days,
    amount: round2(dailyRate * leave.days),
  }));
  const unpaidLeaveDays = leaveBreakdown.reduce((sum, l) => sum + l.days, 0);
  const unpaidLeaveDeduction = round2(leaveBreakdown.reduce((sum, l) => sum + l.amount, 0));

  // Neither has an input mechanism yet (no ad-hoc bonus or one-off deduction
  // endpoint exists in this sprint) — present in the model for the schema's
  // "Bonus" / "Other Authorized Deductions" terms and future extension.
  const bonus = 0;
  const otherDeductions = 0;

  const gross = round2(salaryProfile.basicSalary + fixedAllowances + approvedOvertimePay + bonus);
  const deductions = round2(fixedDeductions + unpaidLeaveDeduction + otherDeductions);
  const net = round2(gross - deductions);

  return {
    // Appendix A lists both `earnings` and `gross` as separate PayrollItem
    // columns without defining a distinction; treated as synonyms for MVP
    // (both = total positive pay before deductions).
    earnings: gross,
    deductions,
    gross,
    net,
    snapshotInput: {
      salaryProfileId: salaryProfile.id,
      basicSalary: salaryProfile.basicSalary,
      allowances: salaryProfile.allowances,
      fixedAllowances: round2(fixedAllowances),
      deductions: salaryProfile.deductions,
      fixedDeductions: round2(fixedDeductions),
      standardMonthlyHours,
      standardWorkingDays,
      hourlyRate: round2(hourlyRate),
      dailyRate: round2(dailyRate),
      overtime: overtimeBreakdown,
      approvedOvertimePay,
      unpaidLeave: leaveBreakdown,
      unpaidLeaveDays,
      unpaidLeaveDeduction,
      bonus,
      otherDeductions,
    },
  };
}

// "YYYY-MM" -> the calendar month's [start, end] as UTC dates, inclusive.
// HLD MVP assumption (section 1 table): payroll is monthly.
export function periodToDateRange(period: string): { start: Date; end: Date } {
  const [yearStr, monthStr] = period.split("-");
  const year = Number(yearStr);
  const month = Number(monthStr); // 1-12
  const start = new Date(Date.UTC(year, month - 1, 1));
  const end = new Date(Date.UTC(year, month, 0)); // day 0 of next month = last day of this one
  return { start, end };
}
