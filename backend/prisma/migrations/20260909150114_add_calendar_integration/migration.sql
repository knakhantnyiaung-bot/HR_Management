-- AlterTable: interviews — structured interviewers replaces interviewerNames
ALTER TABLE "interviews" ADD COLUMN     "interviewers" JSONB NOT NULL DEFAULT '[]',
ADD COLUMN     "calendar_event_id" TEXT;

-- Backfill: comma-split interviewer_names into [{name, email: null}, ...].
-- email is null for every migrated row (no calendar invite for a Sprint 2
-- interview that already happened — this is intentional, see schema.prisma).
UPDATE "interviews"
SET "interviewers" = COALESCE(
  (
    SELECT jsonb_agg(jsonb_build_object('name', trim(name_part), 'email', NULL))
    FROM unnest(string_to_array("interviewer_names", ',')) AS name_part
    WHERE trim(name_part) <> ''
  ),
  '[]'::jsonb
)
WHERE "interviewer_names" IS NOT NULL;

ALTER TABLE "interviews" DROP COLUMN "interviewer_names";

-- CreateTable
CREATE TABLE "calendar_integrations" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "provider" TEXT NOT NULL DEFAULT 'GOOGLE',
    "access_token_enc" TEXT NOT NULL,
    "refresh_token_enc" TEXT NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "calendar_id" TEXT NOT NULL,
    "connected_by_user_id" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "calendar_integrations_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "calendar_integrations_organization_id_key" ON "calendar_integrations"("organization_id");

-- AddForeignKey
ALTER TABLE "calendar_integrations" ADD CONSTRAINT "calendar_integrations_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "calendar_integrations" ADD CONSTRAINT "calendar_integrations_connected_by_user_id_fkey" FOREIGN KEY ("connected_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
