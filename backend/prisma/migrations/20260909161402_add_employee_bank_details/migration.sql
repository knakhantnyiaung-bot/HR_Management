-- AlterTable: employees bank details (BANK-01)
ALTER TABLE "employees" ADD COLUMN     "bank_name" TEXT,
ADD COLUMN     "bank_account_name" TEXT,
ADD COLUMN     "bank_account_number" TEXT;
