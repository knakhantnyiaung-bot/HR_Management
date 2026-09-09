import type { NextFunction, Request, Response } from "express";
import { MulterError } from "multer";
import { ZodError } from "zod";
import { AppError } from "@common/errors/AppError";

export function errorHandler(
  err: unknown,
  req: Request,
  res: Response,
  _next: NextFunction,
): void {
  if (err instanceof AppError) {
    res.status(err.statusCode).json({
      success: false,
      error: { code: err.code, message: err.message },
    });
    return;
  }

  // Sec 13 upload limits (multerConfig.ts) surface as MulterError, not
  // AppError — mapped here so an oversized/extra file is a 400, not a 500.
  if (err instanceof MulterError) {
    res.status(400).json({
      success: false,
      error: { code: `UPLOAD_${err.code}`, message: err.message },
    });
    return;
  }

  if (err instanceof ZodError) {
    res.status(400).json({
      success: false,
      error: {
        code: "VALIDATION_ERROR",
        message: "Invalid request payload",
        details: err.flatten(),
      },
    });
    return;
  }

  req.log?.error({ err }, "Unhandled error");
  res.status(500).json({
    success: false,
    error: { code: "INTERNAL_ERROR", message: "Unexpected server failure" },
  });
}
