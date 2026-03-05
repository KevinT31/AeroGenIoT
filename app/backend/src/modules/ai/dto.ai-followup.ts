import { IsOptional, IsString, IsUrl, IsUUID } from "class-validator";

export class AiFollowupDto {
  @IsUUID()
  reportId: string;

  @IsString()
  userMessage: string;

  @IsOptional()
  @IsUrl()
  newImageUrl?: string;

  @IsOptional()
  @IsUrl()
  audioNoteUrl?: string;
}
