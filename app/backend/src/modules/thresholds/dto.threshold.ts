import { IsNumber, IsOptional, IsString } from "class-validator";

export class ThresholdDto {
  @IsString()
  farmId: string;

  @IsOptional()
  @IsString()
  plotId?: string;

  @IsNumber()
  humidityMin: number;
  @IsNumber()
  humidityMax: number;
  @IsNumber()
  temperatureMin: number;
  @IsNumber()
  temperatureMax: number;
  @IsNumber()
  phMin: number;
  @IsNumber()
  phMax: number;
  @IsNumber()
  ceMin: number;
  @IsNumber()
  ceMax: number;
  @IsNumber()
  nMin: number;
  @IsNumber()
  nMax: number;
  @IsNumber()
  pMin: number;
  @IsNumber()
  pMax: number;
  @IsNumber()
  kMin: number;
  @IsNumber()
  kMax: number;
}