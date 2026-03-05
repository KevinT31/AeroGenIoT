import { IsBoolean, IsLatitude, IsLongitude, IsOptional, IsString, IsUUID } from "class-validator";

export class PlotCreateDto {
  @IsString()
  name: string;

  @IsOptional()
  @IsString()
  cropType?: string;

  @IsOptional()
  @IsUUID()
  cropId?: string;

  @IsOptional()
  @IsUUID()
  stageId?: string;

  @IsOptional()
  @IsUUID()
  zoneId?: string;

  @IsOptional()
  @IsLatitude()
  latitude?: number;

  @IsOptional()
  @IsLongitude()
  longitude?: number;

  @IsOptional()
  @IsBoolean()
  shareAnon?: boolean;

  @IsOptional()
  @IsString()
  notes?: string;
}
