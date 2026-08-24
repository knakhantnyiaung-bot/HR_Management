import bcrypt from "bcrypt";
import { prisma } from "../src/database/prisma";

async function main() {
  const organization = await prisma.organization.upsert({
    where: { id: "00000000-0000-0000-0000-000000000001" },
    update: {},
    create: {
      id: "00000000-0000-0000-0000-000000000001",
      name: "Demo Software Solutions Co.",
      timezone: "Asia/Yangon",
      currency: "MMK",
    },
  });

  const department = await prisma.department.create({
    data: { organizationId: organization.id, name: "Engineering" },
  });

  const position = await prisma.position.create({
    data: { organizationId: organization.id, departmentId: department.id, title: "Software Engineer" },
  });

  const passwordHash = await bcrypt.hash("ChangeMe123!", 10);

  const user = await prisma.user.create({
    data: {
      organizationId: organization.id,
      email: "hr.admin@demo.local",
      passwordHash,
      role: "HR_ADMIN",
    },
  });

  await prisma.employee.create({
    data: {
      organizationId: organization.id,
      userId: user.id,
      employeeNo: "EMP-0001",
      joinDate: new Date(),
      departmentId: department.id,
      positionId: position.id,
      workModel: "HYBRID",
      status: "ACTIVE",
    },
  });

  // eslint-disable-next-line no-console
  console.log("Seed complete. HR admin login: hr.admin@demo.local / ChangeMe123!");
}

main()
  .catch((err) => {
    // eslint-disable-next-line no-console
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
