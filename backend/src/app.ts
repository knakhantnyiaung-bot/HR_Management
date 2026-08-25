import express from "express";
import cors from "cors";
import helmet from "helmet";
import pinoHttp from "pino-http";

import { authRouter } from "@modules/auth/auth.routes";
import { organizationsRouter } from "@modules/organizations/organizations.routes";
import { departmentsRouter } from "@modules/departments/departments.routes";
import { positionsRouter } from "@modules/positions/positions.routes";
import { employeesRouter } from "@modules/employees/employees.routes";
import { attendanceRouter } from "@modules/attendance/attendance.routes";
import { leaveRouter } from "@modules/leave/leave.routes";
import { overtimeRouter } from "@modules/overtime/overtime.routes";
import { payrollRouter } from "@modules/payroll/payroll.routes";
import { payslipsRouter } from "@modules/payslips/payslips.routes";
import { dashboardRouter } from "@modules/dashboard/dashboard.routes";

import { errorHandler } from "@common/middleware/errorHandler";
import { notFoundHandler } from "@common/middleware/notFound";

export function createApp() {
  const app = express();

  app.use(helmet());
  app.use(cors());
  app.use(express.json());
  // Bearer tokens and cookies must never land in plaintext logs — anyone
  // with log read access could otherwise lift a live session and
  // impersonate that user until the token expires.
  app.use(
    pinoHttp({
      redact: {
        paths: [
          "req.headers.authorization",
          "req.headers.cookie",
          "res.headers['set-cookie']",
        ],
        censor: "[Redacted]",
      },
    }),
  );

  app.get("/health", (_req, res) => {
    res.json({ success: true, data: { status: "ok" } });
  });

  const v1 = express.Router();
  v1.use("/auth", authRouter);
  v1.use("/organization", organizationsRouter);
  v1.use("/departments", departmentsRouter);
  v1.use("/positions", positionsRouter);
  v1.use("/employees", employeesRouter);
  v1.use("/attendance", attendanceRouter);
  v1.use("/leave", leaveRouter);
  v1.use("/overtime", overtimeRouter);
  v1.use("/payroll", payrollRouter);
  v1.use("/payslips", payslipsRouter);
  v1.use("/dashboard", dashboardRouter);

  app.use("/api/v1", v1);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
