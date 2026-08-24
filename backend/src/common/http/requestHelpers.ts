import type { Request } from "express";
import type { AuthContext } from "@common/auth/requireAuth";
import { AppError } from "@common/errors/AppError";

export function requireAuthContext(req: Request): AuthContext {
  if (!req.auth) {
    throw AppError.unauthorized();
  }
  return req.auth;
}

export function requireParam(req: Request, name: string): string {
  const value = req.params[name];
  if (!value) {
    throw AppError.badRequest("MISSING_PARAM", `Route parameter '${name}' is required`);
  }
  return value;
}

export function requireIdParam(req: Request): string {
  return requireParam(req, "id");
}
