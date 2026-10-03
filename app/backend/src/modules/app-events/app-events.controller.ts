import { Body, Controller, Post, Req, UseGuards } from "@nestjs/common";
import { JwtAuthGuard } from "../common/jwt.guard";
import { AppEventsService } from "./app-events.service";
import { AppEventDto } from "./dto.app-event";

@Controller("app-events")
export class AppEventsController {
  constructor(private readonly events: AppEventsService) {}

  @Post()
  @UseGuards(JwtAuthGuard)
  create(@Req() req: any, @Body() dto: AppEventDto) {
    return this.events.create(req.user?.sub, dto);
  }
}
