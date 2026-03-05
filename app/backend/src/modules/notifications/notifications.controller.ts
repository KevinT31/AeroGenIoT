import { Body, Controller, Post, Req, UseGuards } from "@nestjs/common";
import { JwtAuthGuard } from "../common/jwt.guard";
import { NotificationsService } from "./notifications.service";
import { RegisterPushDto } from "./dto.register";

@Controller("notifications")
export class NotificationsController {
  constructor(private readonly notifications: NotificationsService) {}

  @Post("register")
  @UseGuards(JwtAuthGuard)
  register(@Req() req: any, @Body() dto: RegisterPushDto) {
    return this.notifications.register(req.user?.sub, dto);
  }

  @Post("test")
  @UseGuards(JwtAuthGuard)
  test(@Req() req: any) {
    return this.notifications.sendTest(req.user?.sub);
  }
}
