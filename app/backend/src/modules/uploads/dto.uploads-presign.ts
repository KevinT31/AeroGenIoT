import { IsIn, IsOptional, IsString } from "class-validator";

export class UploadPresignDto {
  @IsString()
  contentType: string;

  @IsOptional()
  @IsString()
  extension?: string;

  @IsOptional()
  @IsIn(["image", "audio", "video", "general"])
  kind?: "image" | "audio" | "video" | "general";
}
