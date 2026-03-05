import { Type } from "class-transformer";
import {
  ArrayMaxSize,
  IsArray,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  IsUrl,
  IsUUID,
  Min,
  ValidateNested,
} from "class-validator";

export const ORGAN_VALUES = ["leaf", "flower", "fruit", "bark", "stem", "auto"] as const;
export type OrganType = (typeof ORGAN_VALUES)[number];

export class AiLocationDto {
  @IsOptional()
  @IsUUID()
  zoneId?: string;

  @IsOptional()
  @IsString()
  countryCode?: string;

  @IsOptional()
  @IsString()
  region?: string;

  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  lat?: number;

  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  lon?: number;

  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  accuracyM?: number;

  @IsOptional()
  @IsString()
  district?: string;
}

export class AiMediaDto {
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(5)
  @IsUrl({}, { each: true })
  photos?: string[];

  @IsOptional()
  @IsUrl()
  video?: string;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(5)
  @IsString({ each: true })
  organsHint?: OrganType[];

  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  @Min(0)
  videoDurationSec?: number;
}

export class AiDiagnosisDto {
  @IsOptional()
  @IsUUID()
  parcelId?: string;

  @IsOptional()
  @IsUUID()
  cropId?: string;

  @IsOptional()
  @IsUUID()
  stageId?: string;

  @IsOptional()
  @IsString()
  crop?: string;

  @IsOptional()
  @IsString()
  variety?: string;

  @IsOptional()
  @IsString()
  growthStage?: string;

  @IsOptional()
  @IsString()
  lang?: string;

  @ValidateNested()
  @Type(() => AiMediaDto)
  media: AiMediaDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => AiLocationDto)
  location?: AiLocationDto;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsOptional()
  @IsObject()
  answers?: Record<string, string>;
}
