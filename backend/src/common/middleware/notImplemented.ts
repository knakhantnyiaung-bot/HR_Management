import type { Request, Response } from "express";

export function notImplemented(req: Request, res: Response): void {
  res.status(501).json({
    success: false,
    error: {
      code: "NOT_IMPLEMENTED",
      message: `${req.method} ${req.baseUrl}${req.path} is scaffolded but not yet implemented`,
    },
  });
}
