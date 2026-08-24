import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { env } from "@config/env";
import { prisma } from "@database/prisma";
import { AppError } from "@common/errors/AppError";
import type { LoginInput } from "@modules/auth/auth.schema";

export async function authenticate({ email, password }: LoginInput) {
  const user = await prisma.user.findFirst({ where: { email } });

  if (!user || user.status !== "ACTIVE") {
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
