import { IsArray, IsObject, IsOptional, IsString } from "class-validator";

export class UpdatePreferencesDto {
  @IsOptional()
  @IsString()
  unitSystem?: string;

  @IsOptional()
  @IsString()
  language?: string;

  @IsOptional()
  @IsArray()
  alertChannels?: string[];

  @IsOptional()
  @IsObject()
  profile?: Record<string, unknown>;

  @IsOptional()
  @IsString()
  activeDeviceId?: string;
}
