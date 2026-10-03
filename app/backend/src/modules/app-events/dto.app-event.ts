import { IsIn, IsObject, IsOptional, IsString, MaxLength } from "class-validator";

const categories = ["session", "screen", "interaction", "network", "crash"] as const;

export class AppEventDto {
  @IsString()
  @MaxLength(80)
  event: string;

  @IsOptional()
  @IsIn(categories)
  category?: (typeof categories)[number];

  @IsOptional()
  @IsString()
  @MaxLength(120)
  deviceId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  platform?: string;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  appVersion?: string;

  @IsOptional()
  @IsObject()
  payload?: Record<string, unknown>;
}
