import type { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";
import { env } from "@config/env";
import { prisma } from "@database/prisma";
import { AppError } from "@common/errors/AppError";

export interface AuthContext {
  userId: string;
  organizationId: string;
  role: "SUPER_ADMIN" | "HR_ADMIN" | "EMPLOYEE";
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      auth?: AuthContext;
    }
  }
}

// AUTH-01/AUTH-05: a valid signature alone isn't enough — the token's role
// is only ever as fresh as the moment it was issued. Re-reading the user on
// every request means deactivating/terminating someone (or changing their
// role) takes effect on their very next call instead of silently waiting out
// the token's remaining lifetime (up to JWT_EXPIRES_IN).
export async function requireAuth(req: Request, _res: Response, next: NextFunction): Promise<void> {
  try {
    const header = req.headers.authorization;
    if (!header?.startsWith("Bearer ")) {
      throw AppError.unauthorized();
    }

    const token = header.slice("Bearer ".length);

    let payload: AuthContext;
    try {
      payload = jwt.verify(token, env.jwtSecret) as AuthContext;
    } catch {
      throw AppError.unauthorized("Invalid or expired token");
    }

    const user = await prisma.user.findUnique({
      where: { id: payload.userId },
      select: { status: true, role: true, organizationId: true },
    });
    if (!user || user.status !== "ACTIVE") {
      throw AppError.unauthorized("Invalid or expired token");
    }

    req.auth = { userId: payload.userId, organizationId: user.organizationId, role: user.role };
    next();
  } catch (err) {
    next(err);
  }
}

export function requireRole(...roles: AuthContext["role"][]) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.auth || !roles.includes(req.auth.role)) {
      throw AppError.forbidden();
    }
    next();
  };
}
