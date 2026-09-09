-- CreateEnum
CREATE TYPE "CandidatePortalStatus" AS ENUM ('ACTIVE', 'INACTIVE');

-- AlterTable
ALTER TABLE "organizations" ADD COLUMN     "careers_enabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "careers_slug" TEXT;

-- CreateTable
CREATE TABLE "candidate_portal_accounts" (
    "id" TEXT NOT NULL,
    "candidate_id" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "status" "CandidatePortalStatus" NOT NULL DEFAULT 'ACTIVE',
    "last_login_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "candidate_portal_accounts_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "candidate_portal_accounts_candidate_id_key" ON "candidate_portal_accounts"("candidate_id");

-- CreateIndex
CREATE UNIQUE INDEX "organizations_careers_slug_key" ON "organizations"("careers_slug");

-- AddForeignKey
ALTER TABLE "candidate_portal_accounts" ADD CONSTRAINT "candidate_portal_accounts_candidate_id_fkey" FOREIGN KEY ("candidate_id") REFERENCES "candidates"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
