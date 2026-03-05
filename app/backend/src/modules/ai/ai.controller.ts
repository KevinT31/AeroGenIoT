import { Body, Controller, Post, Req, UseGuards } from "@nestjs/common";
import { JwtAuthGuard } from "../common/jwt.guard";
import { AiService } from "./ai.service";
import { AiDiagnosisDto } from "./dto.ai-diagnosis";
import { AiFollowupDto } from "./dto.ai-followup";

@Controller("ai")
export class AiController {
  constructor(private readonly ai: AiService) {}

  @Post("diagnosis")
  @UseGuards(JwtAuthGuard)
  diagnose(@Req() req: any, @Body() dto: AiDiagnosisDto) {
    return this.ai.diagnose(req.user?.sub, dto);
  }

  @Post("followup")
  @UseGuards(JwtAuthGuard)
  followup(@Req() req: any, @Body() dto: AiFollowupDto) {
    return this.ai.followup(req.user?.sub, dto);
  }
}
