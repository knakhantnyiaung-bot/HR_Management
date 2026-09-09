-- CreateEnum
CREATE TYPE "GeofenceShape" AS ENUM ('CIRCLE', 'POLYGON');

-- AlterTable
ALTER TABLE "geofence_zones" ADD COLUMN     "polygon" JSONB,
ADD COLUMN     "shape" "GeofenceShape" NOT NULL DEFAULT 'CIRCLE',
ALTER COLUMN "lat" DROP NOT NULL,
ALTER COLUMN "lng" DROP NOT NULL,
ALTER COLUMN "radius_meters" DROP NOT NULL;
