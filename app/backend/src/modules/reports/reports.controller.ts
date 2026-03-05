import { Body, Controller, Get, Param, Post, Query, Req, UseGuards } from "@nestjs/common";
import { JwtAuthGuard } from "../common/jwt.guard";
import { ReportsService } from "./reports.service";
import { ReportFeedbackDto } from "./dto.report-feedback";

@Controller("reports")
export class ReportsController {
  constructor(private readonly reports: ReportsService) {}

  @Get()
  @UseGuards(JwtAuthGuard)
  list(@Req() req: any, @Query("parcelId") parcelId?: string, @Query("cropId") cropId?: string, @Query("status") status?: string) {
    return this.reports.list(req.user?.sub, { parcelId, cropId, status });
  }

  @Get(":reportId")
  @UseGuards(JwtAuthGuard)
  get(@Req() req: any, @Param("reportId") reportId: string) {
    return this.reports.get(req.user?.sub, reportId);
  }

  @Post(":reportId/feedback")
  @UseGuards(JwtAuthGuard)
  feedback(@Req() req: any, @Param("reportId") reportId: string, @Body() dto: ReportFeedbackDto) {
    return this.reports.feedback(req.user?.sub, reportId, dto.value);
  }
}
