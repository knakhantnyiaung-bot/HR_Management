import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { env } from "@config/env";
import { prisma } from "@database/prisma";
import { AppError } from "@common/errors/AppError";
import type { LoginInput } from "@modules/auth/auth.schema";

// Not a real user's hash — just a fixed, valid bcrypt hash to compare
// against when there's no real one, so the not-found/inactive path pays the
// same bcrypt cost as a wrong-password path instead of returning early.
// Without this, response timing alone lets an attacker enumerate which
// emails have accounts.
const DUMMY_PASSWORD_HASH = "$2b$10$7T7vNwID.peQz/tOpfQ/n.18/T.YkEeIlX4YtKCmuw31S.O/41WoC";

export async function authenticate({ email, password }: LoginInput) {
  const user = await prisma.user.findFirst({ where: { email } });

  if (!user || user.status !== "ACTIVE") {
    await bcrypt.compare(password, DUMMY_PASSWORD_HASH);
    throw AppError.unauthorized("Invalid credentials");
  }

  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) {
    throw AppError.unauthorized("Invalid credentials");
  }

  const token = jwt.sign(
    { userId: user.id, organizationId: user.organizationId, role: user.role },
    env.jwtSecret,
    { expiresIn: env.jwtExpiresIn as jwt.SignOptions["expiresIn"] },
  );

  return { token, user: { id: user.id, email: user.email, role: user.role } };
}

export async function getCurrentUser(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, email: true, role: true, organizationId: true, employee: true },
  });

  if (!user) {
    throw AppError.notFound("User");
  }

  return user;
}
