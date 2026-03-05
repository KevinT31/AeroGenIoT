import { Body, Controller, Post, Req, UseGuards } from "@nestjs/common";
import { JwtAuthGuard } from "../common/jwt.guard";
import { UploadsService } from "./uploads.service";
import { UploadPresignDto } from "./dto.uploads-presign";

@Controller("uploads")
export class UploadsController {
  constructor(private readonly uploads: UploadsService) {}

  @Post("presign")
  @UseGuards(JwtAuthGuard)
  create(@Req() req: any, @Body() dto: UploadPresignDto) {
    return this.uploads.createPresignedUrl(req.user?.sub, dto);
  }
}
