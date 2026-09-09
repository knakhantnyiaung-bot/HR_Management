-- CreateEnum
CREATE TYPE "LocationSource" AS ENUM ('GPS', 'MANUAL', 'UNAVAILABLE');

-- AlterTable
ALTER TABLE "attendance_records" ADD COLUMN     "check_in_accuracy_m" INTEGER,
ADD COLUMN     "check_in_lat" DOUBLE PRECISION,
ADD COLUMN     "check_in_lng" DOUBLE PRECISION,
ADD COLUMN     "check_out_accuracy_m" INTEGER,
ADD COLUMN     "check_out_lat" DOUBLE PRECISION,
ADD COLUMN     "check_out_lng" DOUBLE PRECISION,
ADD COLUMN     "location_source" "LocationSource" NOT NULL DEFAULT 'UNAVAILABLE';

-- AlterTable
ALTER TABLE "organizations" ADD COLUMN     "location_capture_enabled" BOOLEAN NOT NULL DEFAULT true;
