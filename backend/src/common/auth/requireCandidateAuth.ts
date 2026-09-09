import type { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";
import { env } from "@config/env";
import { prisma } from "@database/prisma";
import { AppError } from "@common/errors/AppError";

export interface CandidateAuthContext {
  candidateId: string;
  organizationId: string;
}

interface CandidateJwtPayload {
  candidateId: string;
  typ: "candidate";
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      candidateAuth?: CandidateAuthContext;
    }
  }
}

// CAREER-04 — structurally separate from requireAuth (HLD §3): signed with
// CANDIDATE_JWT_SECRET (never JWT_SECRET), so an internal token can never
// verify here and a candidate token can never verify against requireAuth —
// this isn't just the `typ` claim below, the signature itself won't check
// out against the wrong secret. Re-reads the account's live status on every
// request, same AUTH-05 freshness rationale as requireAuth.
export async function requireCandidateAuth(
  req: Request,
  _res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const header = req.headers.authorization;
    if (!header?.startsWith("Bearer ")) {
      throw AppError.unauthorized();
    }

    const token = header.slice("Bearer ".length);

    let payload: CandidateJwtPayload;
    try {
      payload = jwt.verify(token, env.candidateJwtSecret) as CandidateJwtPayload;
    } catch {
      throw AppError.unauthorized("Invalid or expired token");
    }
    if (payload.typ !== "candidate") {
      throw AppError.unauthorized("Invalid or expired token");
    }

    const account = await prisma.candidatePortalAccount.findUnique({
      where: { candidateId: payload.candidateId },
      select: { status: true, candidate: { select: { organizationId: true } } },
    });
    if (!account || account.status !== "ACTIVE") {
      throw AppError.unauthorized("Invalid or expired token");
    }

    req.candidateAuth = {
      candidateId: payload.candidateId,
      organizationId: account.candidate.organizationId,
    };
    next();
  } catch (err) {
    next(err);
  }
}
