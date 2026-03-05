import { IsEnum, IsOptional, IsString } from "class-validator";
import { DeviceStatus } from "@prisma/client";

export class DeviceUpdateDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsEnum(DeviceStatus)
  status?: DeviceStatus;
}
