import { Body, Controller, Get, Post, Query, Req, UseGuards } from "@nestjs/common";
import { JwtAuthGuard } from "../common/jwt.guard";
import { AiService } from "./ai.service";
import { AiDiagnosisDto } from "./dto.ai-diagnosis";
import { AiFollowupDto } from "./dto.ai-followup";
import { AiOperationalService } from "./ai-operational.service";

@Controller("ai")
export class AiController {
  constructor(
    private readonly ai: AiService,
    private readonly operationalAi: AiOperationalService,
  ) {}

  @Get("operational")
  operational(@Query("deviceId") deviceId?: string) {
    return this.operationalAi.latest(deviceId);
  }

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
