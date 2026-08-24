import type { NextFunction, Request, RequestHandler, Response } from "express";

// Express 4 does not forward rejected promises to error-handling middleware.
// Route handlers that `throw` inside an async function need this wrapper so
// AppError/ZodError reach errorHandler.ts instead of crashing the process.
export function asyncHandler(
  handler: (req: Request, res: Response, next: NextFunction) => Promise<void>,
): RequestHandler {
  return (req, res, next) => {
    handler(req, res, next).catch(next);
  };
}
