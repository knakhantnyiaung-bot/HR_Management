// Mirrors backend Prisma enum PayrollRunStatus (payroll.routes.ts Appendix C
// state machine: DRAFT -> CALCULATED -> APPROVED -> PAID).
export type PayrollRunStatus = "DRAFT" | "CALCULATED" | "APPROVED" | "PAID";
