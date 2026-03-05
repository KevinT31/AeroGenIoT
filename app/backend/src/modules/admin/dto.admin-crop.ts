import { IsString } from "class-validator";

export class AdminCropDto {
  @IsString()
  name: string;
}
