import { IsOptional, IsString } from "class-validator";

export class FarmUpdateDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  location?: string;
}