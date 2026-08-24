import { describe, expect, it } from "vitest";
import {
  DEFAULT_STANDARD_MONTHLY_HOURS,
  DEFAULT_STANDARD_WORKING_DAYS,
  calculatePayrollItem,
  periodToDateRange,
} from "@modules/payroll/payroll.calculator";

describe("calculatePayrollItem", () => {
  it("computes gross/net from basic salary, allowances, OT, deductions, and unpaid leave", () => {
    // Round divisors chosen so every intermediate amount is exact — this
    // test is about the formula, not floating-point rounding.
    const result = calculatePayrollItem({
      salaryProfile: {
        id: "sp1",
        basicSalary: 1_000_000,
        allowances: { transport: 50_000, meal: 30_000 },
        deductions: { tax: 20_000 },
        standardMonthlyHours: 200,
        standardWorkingDays: 25,
      },
      approvedOvertime: [{ id: "ot1", hours: 4, multiplier: 1.5 }],
      unpaidLeave: [{ id: "lv1", days: 2 }],
    });

    // hourlyRate = 1,000,000 / 200 = 5,000; OT = 5,000 * 4 * 1.5 = 30,000
    // dailyRate = 1,000,000 / 25 = 40,000; leave deduction = 40,000 * 2 = 80,000
    expect(result.gross).toBe(1_110_000); // 1,000,000 + 80,000 allowances + 30,000 OT
    expect(result.deductions).toBe(100_000); // 20,000 fixed + 80,000 unpaid leave
    expect(result.net).toBe(1_010_000);
    expect(result.earnings).toBe(result.gross);
  });

  it("falls back to the documented default divisors when otSettings has none", () => {
    const result = calculatePayrollItem({
      salaryProfile: {
        id: "sp1",
        basicSalary: 1_040_000,
        allowances: {},
        deductions: {},
      },
      approvedOvertime: [],
      unpaidLeave: [],
    });

    expect(result.snapshotInput.standardMonthlyHours).toBe(DEFAULT_STANDARD_MONTHLY_HOURS);
    expect(result.snapshotInput.standardWorkingDays).toBe(DEFAULT_STANDARD_WORKING_DAYS);
    // 1,040,000 / 208 = 5,000 exactly — picked so the default divisor itself
    // is under test, not just "some number close to it".
    expect(result.snapshotInput.hourlyRate).toBe(5_000);
    expect(result.gross).toBe(1_040_000);
    expect(result.deductions).toBe(0);
    expect(result.net).toBe(1_040_000);
  });

  it("produces a snapshot with no back-reference to mutable state — only plain values", () => {
    const result = calculatePayrollItem({
      salaryProfile: {
        id: "sp1",
        basicSalary: 500_000,
        allowances: { housing: 100_000 },
        deductions: {},
      },
      approvedOvertime: [{ id: "ot1", hours: 2, multiplier: 2 }],
      unpaidLeave: [{ id: "lv1", days: 1 }],
    });

    expect(result.snapshotInput).toMatchObject({
      salaryProfileId: "sp1",
      basicSalary: 500_000,
      allowances: { housing: 100_000 },
      overtime: [{ id: "ot1", hours: 2, multiplier: 2, amount: expect.any(Number) }],
      unpaidLeave: [{ id: "lv1", days: 1, amount: expect.any(Number) }],
    });
  });

  it("ignores non-numeric allowance/deduction entries instead of producing NaN", () => {
    const result = calculatePayrollItem({
      salaryProfile: {
        id: "sp1",
        basicSalary: 100_000,
        allowances: { valid: 10_000, garbage: Number.NaN },
        deductions: {},
      },
      approvedOvertime: [],
      unpaidLeave: [],
    });

    expect(result.gross).toBe(110_000);
    expect(Number.isFinite(result.gross)).toBe(true);
  });
});

describe("periodToDateRange", () => {
  it("resolves a normal month", () => {
    const { start, end } = periodToDateRange("2026-03");
    expect(start.toISOString()).toBe("2026-03-01T00:00:00.000Z");
    expect(end.toISOString()).toBe("2026-03-31T00:00:00.000Z");
  });

  it("handles a December -> January year boundary correctly", () => {
    const { start, end } = periodToDateRange("2026-12");
    expect(start.toISOString()).toBe("2026-12-01T00:00:00.000Z");
    expect(end.toISOString()).toBe("2026-12-31T00:00:00.000Z");
  });

  it("resolves February in a leap year to 29 days", () => {
    const { end } = periodToDateRange("2028-02");
    expect(end.toISOString()).toBe("2028-02-29T00:00:00.000Z");
  });

  it("resolves February in a non-leap year to 28 days", () => {
    const { end } = periodToDateRange("2026-02");
    expect(end.toISOString()).toBe("2026-02-28T00:00:00.000Z");
  });
});
