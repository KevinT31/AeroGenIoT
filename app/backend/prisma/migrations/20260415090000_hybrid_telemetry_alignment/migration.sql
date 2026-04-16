ALTER TYPE "AlertType" ADD VALUE IF NOT EXISTS 'battery_overtemperature';
ALTER TYPE "AlertType" ADD VALUE IF NOT EXISTS 'controller_overload';
ALTER TYPE "AlertType" ADD VALUE IF NOT EXISTS 'inverter_overload';
ALTER TYPE "AlertType" ADD VALUE IF NOT EXISTS 'inverter_fault';
ALTER TYPE "AlertType" ADD VALUE IF NOT EXISTS 'supply_cut';
ALTER TYPE "AlertType" ADD VALUE IF NOT EXISTS 'rotor_rpm_out_of_range';

ALTER TABLE "SensorReading"
ADD COLUMN "windDirectionDeg" DOUBLE PRECISION,
ADD COLUMN "vibrationSignal" DOUBLE PRECISION,
ADD COLUMN "batteryAutonomyEstimatedH" DOUBLE PRECISION,
ADD COLUMN "outputVoltageAcV" DOUBLE PRECISION,
ADD COLUMN "outputCurrentAcA" DOUBLE PRECISION,
ADD COLUMN "rotorRpm" DOUBLE PRECISION,
ADD COLUMN "energyDeliveredWh" DOUBLE PRECISION,
ADD COLUMN "batteryAlertLow" BOOLEAN,
ADD COLUMN "batteryAlertOverload" BOOLEAN,
ADD COLUMN "batteryAlertOvertemp" BOOLEAN,
ADD COLUMN "inverterAlertOverload" BOOLEAN,
ADD COLUMN "inverterAlertFault" BOOLEAN,
ADD COLUMN "inverterAlertSupplyCut" BOOLEAN;
