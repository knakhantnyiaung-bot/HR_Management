import { WorkModel } from "@prisma/client";
import { z } from "zod";

export const createEmployeeSchema = z.object({
  email: z
    .string()
    .email()
    .transform((v) => v.toLowerCase()),
  password: z.string().min(8).optional(),
  employeeNo: z.string().min(1).optional(),
  joinDate: z.coerce.date(),
  departmentId: z.string().uuid(),
  positionId: z.string().uuid(),
  workModel: z.nativeEnum(WorkModel).default(WorkModel.OFFICE),
});

export type CreateEmployeeInput = z.infer<typeof createEmployeeSchema>;

export const updateEmployeeSchema = z
  .object({
    departmentId: z.string().uuid().optional(),
    positionId: z.string().uuid().optional(),
    workModel: z.nativeEnum(WorkModel).optional(),
    joinDate: z.coerce.date().optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: "At least one field must be provided",
  });

export type UpdateEmployeeInput = z.infer<typeof updateEmployeeSchema>;

export const listEmployeesQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  departmentId: z.string().uuid().optional(),
  status: z.enum(["DRAFT", "ACTIVE", "INACTIVE", "TERMINATED"]).optional(),
});

export type ListEmployeesQuery = z.infer<typeof listEmployeesQuerySchema>;
