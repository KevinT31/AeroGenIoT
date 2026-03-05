import { IsOptional, IsString } from "class-validator";

export class DeviceCreateDto {
  @IsString()
  name: string;
}