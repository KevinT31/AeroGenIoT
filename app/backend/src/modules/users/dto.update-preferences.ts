import { IsArray, IsString } from "class-validator";

export class UpdatePreferencesDto {
  @IsString()
  unitSystem: string;

  @IsString()
  language: string;

  @IsArray()
  alertChannels: string[];
}