import { Type } from "class-transformer";
import {
  IsDateString,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  Min,
} from "class-validator";

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

  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(100)
  windSpeedMs: number;

  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(1000)
  genVoltageV: number;

  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(500)
  genCurrentA: number;

  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(100)
  vibrationRms: number;

  @Type(() => Number)
  @IsNumber()
  @Min(-40)
  @Max(200)
  genTempC: number;

  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(100)
  batteryPct: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(100000)
  loadPowerW?: number;

  @IsOptional()
  @IsString()
  mode?: string;
}
