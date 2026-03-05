-- CreateEnum
CREATE TYPE "PowerSource" AS ENUM ('WIND', 'BATTERY', 'BOTH');

-- AlterEnum
ALTER TYPE "AlertType" ADD VALUE IF NOT EXISTS 'wind_danger';
ALTER TYPE "AlertType" ADD VALUE IF NOT EXISTS 'generator_temp_high';
ALTER TYPE "AlertType" ADD VALUE IF NOT EXISTS 'vibration_high';
ALTER TYPE "AlertType" ADD VALUE IF NOT EXISTS 'battery_low';

-- AlterTable
ALTER TABLE "SensorReading"
ADD COLUMN "genVoltageV" DOUBLE PRECISION,
ADD COLUMN "genCurrentA" DOUBLE PRECISION,
ADD COLUMN "powerW" DOUBLE PRECISION,
ADD COLUMN "loadPowerW" DOUBLE PRECISION,
ADD COLUMN "sourceNow" "PowerSource",
ADD COLUMN "sourceReason" TEXT,
ADD COLUMN "vibrationRms" DOUBLE PRECISION,
ADD COLUMN "genTempC" DOUBLE PRECISION,
ADD COLUMN "batteryPct" DOUBLE PRECISION,
ADD COLUMN "energyTodayKwh" DOUBLE PRECISION,
ADD COLUMN "ingestMode" TEXT;

-- AlterTable
ALTER TABLE "Alert" ADD COLUMN "deviceId" TEXT;

-- CreateIndex
CREATE INDEX "SensorReading_deviceId_timestamp_idx" ON "SensorReading"("deviceId", "timestamp");
CREATE INDEX "Alert_deviceId_createdAt_idx" ON "Alert"("deviceId", "createdAt");

-- AddForeignKey
ALTER TABLE "Alert"
ADD CONSTRAINT "Alert_deviceId_fkey" FOREIGN KEY ("deviceId") REFERENCES "Device"("id") ON DELETE SET NULL ON UPDATE CASCADE;
