-- DropIndex
DROP INDEX "notification_events_status_created_at_idx";

-- AlterTable
ALTER TABLE "notification_events" ADD COLUMN     "next_attempt_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- CreateIndex
CREATE INDEX "notification_events_status_next_attempt_at_idx" ON "notification_events"("status", "next_attempt_at");
