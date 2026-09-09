import type { Prisma } from "@prisma/client";

// Shared across modules that need to notify "whoever can act on this" (HR
// Admin/Super Admin) — leave submission, expense submission, etc. Kept here
// rather than duplicated per-module, same reasoning as
// employees.service.ts's getEmployeeByUserId.
export async function getHrAdminUserIds(
  tx: Prisma.TransactionClient,
  organizationId: string,
): Promise<string[]> {
  const users = await tx.user.findMany({
    where: { organizationId, role: { in: ["HR_ADMIN", "SUPER_ADMIN"] }, status: "ACTIVE" },
    select: { id: true },
  });
  return users.map((u) => u.id);
}
