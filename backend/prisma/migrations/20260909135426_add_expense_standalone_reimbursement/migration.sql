-- CreateEnum
CREATE TYPE "DisbursementMethod" AS ENUM ('BANK_TRANSFER', 'CHEQUE', 'CASH', 'OTHER');

-- AlterTable
ALTER TABLE "expense_claims" ADD COLUMN     "disbursed_at" TIMESTAMP(3),
ADD COLUMN     "disbursed_by" TEXT,
ADD COLUMN     "disbursement_method" "DisbursementMethod",
ADD COLUMN     "disbursement_reference" TEXT;
