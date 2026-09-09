-- AlterTable
ALTER TABLE "notification_preferences" ADD COLUMN     "push_enabled" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "sms_enabled" BOOLEAN NOT NULL DEFAULT true;

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "phone_number" TEXT;

-- CreateTable
CREATE TABLE "push_subscriptions" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "endpoint" TEXT NOT NULL,
    "p256dh" TEXT NOT NULL,
    "auth" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "push_subscriptions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "push_subscriptions_user_id_idx" ON "push_subscriptions"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "push_subscriptions_user_id_endpoint_key" ON "push_subscriptions"("user_id", "endpoint");

-- AddForeignKey
ALTER TABLE "push_subscriptions" ADD CONSTRAINT "push_subscriptions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
