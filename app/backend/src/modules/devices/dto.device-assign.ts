import { IsOptional, IsString } from "class-validator";

export class DeviceAssignDto {
  @IsOptional()
  @IsString()
  farmId?: string;

  @IsOptional()
  @IsString()
  plotId?: string;
}