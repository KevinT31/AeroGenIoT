import { IsNumber, IsOptional, IsString } from "class-validator";

export class AdminStageDto {
  @IsString()
  name: string;

  @IsOptional()
  @IsNumber()
  order?: number;
}
