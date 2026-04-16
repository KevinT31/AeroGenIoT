import { Transform, Type } from "class-transformer";
import {
  IsDateString,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  Min,
} from "class-validator";

const toBoolean = ({ value }: { value: unknown }) => {
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return value !== 0;
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    if (["true", "1", "yes", "si"].includes(normalized)) return true;
    if (["false", "0", "no"].includes(normalized)) return false;
  }
  return value;
};

export class IngestReadingDto {
  @IsString()
  deviceId: string;

  @IsOptional()
  @IsString()
  farmId?: string;

  @IsOptional()
  @IsString()
  plotId?: string;

  @IsOptional()
  @IsDateString()
  ts?: string;

  @IsOptional()
  @IsDateString()
  timestamp?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(100)
  windSpeedMs?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(100)
  wind_speed_mps?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(359)
  wind_dir_deg?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(359)
  windDirectionDeg?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(-1000)
  @Max(1000)
  battery_voltage_dc_v?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(-1000)
  @Max(1000)
  batteryVoltageDcV?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(-1000)
  @Max(1000)
  genVoltageV?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(-500)
  @Max(500)
  battery_current_dc_a?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(-500)
  @Max(500)
  batteryCurrentDcA?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(-500)
  @Max(500)
  genCurrentA?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(-100000)
  @Max(100000)
  battery_power_w?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(-100000)
  @Max(100000)
  batteryPowerW?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(100)
  battery_soc_pct?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(100)
  stateOfChargePct?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(100)
  batterySocPct?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(100)
  batteryPct?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(240)
  battery_autonomy_estimated_h?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(240)
  batteryAutonomyEstimatedH?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(300)
  inverter_output_voltage_ac_v?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(300)
  outputVoltageAcV?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(100)
  inverter_output_current_ac_a?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(100)
  outputCurrentAcA?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(100000)
  house_power_consumption_w?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(100000)
  loadPowerW?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(1000000000)
  energy_delivered_wh?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(1000000000)
  energyDeliveredWh?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(-40)
  @Max(200)
  inverter_temp_c?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(-40)
  @Max(200)
  genTempC?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(100)
  motor_vibration?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(100)
  vibrationRms?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(2)
  vibrationSignal?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(2)
  vibration_signal?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(5000)
  blade_rpm?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(5000)
  rotorRpm?: number;

  @IsOptional()
  @Transform(toBoolean)
  battery_alert_low?: boolean;

  @IsOptional()
  @Transform(toBoolean)
  battery_alert_overload?: boolean;

  @IsOptional()
  @Transform(toBoolean)
  battery_alert_overtemp?: boolean;

  @IsOptional()
  @Transform(toBoolean)
  inverter_alert_overload?: boolean;

  @IsOptional()
  @Transform(toBoolean)
  inverter_alert_fault?: boolean;

  @IsOptional()
  @Transform(toBoolean)
  inverter_alert_supply_cut?: boolean;

  @IsOptional()
  @IsString()
  mode?: string;
}
