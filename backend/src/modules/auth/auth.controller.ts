import type { Request, Response } from "express";
import { AppError } from "@common/errors/AppError";
import { loginSchema } from "@modules/auth/auth.schema";
import { authenticate, getCurrentUser } from "@modules/auth/auth.service";

export async function login(req: Request, res: Response): Promise<void> {
  const input = loginSchema.parse(req.body);
  const result = await authenticate(input);
  res.json({ success: true, data: result });
}

export async function me(req: Request, res: Response): Promise<void> {
  if (!req.auth) {
    throw AppError.unauthorized();
  }
  const user = await getCurrentUser(req.auth.userId);
  res.json({ success: true, data: user });
}
