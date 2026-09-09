import type { Request, Response } from "express";
import { AppError } from "@common/errors/AppError";
import { loginSchema, updateMeSchema } from "@modules/auth/auth.schema";
import { authenticate, getCurrentUser, updateCurrentUser } from "@modules/auth/auth.service";

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

export async function updateMe(req: Request, res: Response): Promise<void> {
  if (!req.auth) {
    throw AppError.unauthorized();
  }
  const input = updateMeSchema.parse(req.body);
  const user = await updateCurrentUser(req.auth.userId, input);
  res.json({ success: true, data: user });
}
