import { IsOptional, IsString } from "class-validator";

export class FarmCreateDto {
  @IsString()
  name: string;

  @IsOptional()
  @IsString()
  location?: string;
}